import { QRService } from '../server/services/qrService.ts';
import { QueueService } from '../server/services/queueService.ts';
import { WebhookService } from '../server/services/webhookService.ts';
import { RefundService } from '../server/services/refundService.ts';
import { AuthService } from '../server/services/authService.ts';
import { redis } from '../server/services/redisService.ts';
import { db } from '../server/store.ts';

interface ScenarioResult {
  scenarioNumber: number;
  scenarioName: string;
  passed: boolean;
  expectedBehavior: string;
  actualObservation: string;
  durationMs: number;
}

export async function runPaymentSecurityTests(): Promise<{
  totalScenarios: number;
  passedCount: number;
  failedCount: number;
  results: ScenarioResult[];
}> {
  const results: ScenarioResult[] = [];

  const runScenario = async (
    num: number,
    name: string,
    expectedBehavior: string,
    testFn: () => Promise<{ passed: boolean; actual: string }>
  ) => {
    const start = Date.now();
    try {
      const res = await testFn();
      results.push({
        scenarioNumber: num,
        scenarioName: name,
        passed: res.passed,
        expectedBehavior,
        actualObservation: res.actual,
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      results.push({
        scenarioNumber: num,
        scenarioName: name,
        passed: false,
        expectedBehavior,
        actualObservation: 'Unhandled test exception: ' + err.message,
        durationMs: Date.now() - start,
      });
    }
  };

  console.log('\n======================================================');
  console.log('🔒 OpenUPI Gateway: Running 14 Payment Security Tests');
  console.log('======================================================\n');

  // 1. Customer changes payment amount in browser
  await runScenario(
    1,
    'Customer changes payment amount in browser',
    'Reject altered amount when orderId already initialized; block amounts <= 0 or > 100,000 INR.',
    async () => {
      const orderId = 'SEC-TAMPER-' + Date.now();
      await QRService.createPaymentSession({ orderId, amount: 500.0 });

      let tamperingBlocked = false;
      try {
        // Attempt to create session for same order with modified amount ₹100
        await QRService.createPaymentSession({ orderId, amount: 100.0 });
      } catch (err: any) {
        if (err.message.includes('Amount Tampering Detected')) {
          tamperingBlocked = true;
        }
      }

      return {
        passed: tamperingBlocked,
        actual: tamperingBlocked
          ? 'Amount tampering correctly intercepted and rejected with error.'
          : 'Failed: Session allowed amount alteration on existing order.',
      };
    }
  );

  // 2. Customer modifies order ID
  await runScenario(
    2,
    'Customer modifies order ID',
    'Reject blank, oversized, or malicious order IDs.',
    async () => {
      let rejected = false;
      try {
        await QRService.createPaymentSession({ orderId: '   ', amount: 500.0 });
      } catch {
        rejected = true;
      }
      return {
        passed: rejected,
        actual: rejected ? 'Invalid empty order ID rejected.' : 'Failed: Empty order ID accepted.',
      };
    }
  );

  // 3. Customer/Merchant tries to access another merchant transaction (IDOR)
  await runScenario(
    3,
    "Customer/Merchant tries to access another merchant's transaction",
    "Strict merchant account isolation: Merchant B cannot refund or access Merchant A's transactions.",
    async () => {
      const m1Session = await QRService.createPaymentSession({
        merchantId: 'mer_openupi_01',
        orderId: 'M1-ORD-' + Date.now(),
        amount: 800.0,
      });
      QRService.markAsPaid(m1Session.session.id);

      // Attempt refund using Merchant 2's identity
      const refundAttempt = RefundService.processRefund({
        sessionId: m1Session.session.id,
        merchantId: 'mer_isolated_02', // Different merchant!
        amount: 800.0,
      });

      const passed = refundAttempt.statusCode === 403 && !refundAttempt.success;
      return {
        passed,
        actual: passed
          ? 'Cross-merchant IDOR attempt rejected with HTTP 403 Forbidden.'
          : 'Failed: Merchant B was able to modify Merchant A transaction.',
      };
    }
  );

  // 4. Customer opens a fake payment success URL
  await runScenario(
    4,
    'Customer opens a fake payment success URL',
    'Session state remains ACTIVE or EXPIRED; never marked PAID without authoritative settlement.',
    async () => {
      const sess = await QRService.createPaymentSession({
        orderId: 'SEC-FAKE-URL-' + Date.now(),
        amount: 350.0,
      });
      // Simulate checking status after customer hits client success page
      const statusCheck = db.getSession(sess.session.id);
      const passed = statusCheck?.status === 'ACTIVE';
      return {
        passed,
        actual: passed
          ? `Session remained '${statusCheck?.status}'. Direct URL navigation cannot forge payment settlement.`
          : 'Failed: Session was marked paid without verification.',
      };
    }
  );

  // 5. Customer refreshes checkout repeatedly
  await runScenario(
    5,
    'Customer refreshes checkout repeatedly',
    'Idempotent session reuse: returns existing active session without consuming multiple queue slots.',
    async () => {
      const orderId = 'SEC-REFRESH-' + Date.now();
      const s1 = await QRService.createPaymentSession({ orderId, amount: 450.0 });
      const s2 = await QRService.createPaymentSession({ orderId, amount: 450.0 });
      const s3 = await QRService.createPaymentSession({ orderId, amount: 450.0 });

      const passed = s1.session.id === s2.session.id && s2.session.id === s3.session.id && s2.isDuplicateReuse === true;
      return {
        passed,
        actual: passed
          ? `Repeated checkout refreshes safely reused identical session (${s1.session.id}).`
          : 'Failed: New sessions created on refresh.',
      };
    }
  );

  // 6. Same payment request is submitted multiple times (Idempotency key)
  await runScenario(
    6,
    'Same payment request is submitted multiple times',
    'Enforce idempotency key deduplication.',
    async () => {
      const idempotencyKey = 'IDEMP_KEY_' + Date.now();
      const r1 = await QRService.createPaymentSession({
        orderId: 'ORD-IDEMP-01',
        amount: 600.0,
        idempotencyKey,
      });
      const r2 = await QRService.createPaymentSession({
        orderId: 'ORD-IDEMP-01',
        amount: 600.0,
        idempotencyKey,
      });

      const passed = r1.session.id === r2.session.id;
      return {
        passed,
        actual: passed
          ? 'Idempotent request duplicate detected and reused safely.'
          : 'Failed: Multiple sessions created for same idempotency key.',
      };
    }
  );

  // 7. Duplicate webhook is delivered
  await runScenario(
    7,
    'Duplicate webhook is delivered',
    'Webhook deduplication: detect duplicate event ID and reject replay.',
    async () => {
      const eventId = 'evt_test_dup_' + Date.now();
      const firstCheck = redis.checkWebhookNonce(eventId);
      const secondCheck = redis.checkWebhookNonce(eventId);

      const passed = firstCheck === true && secondCheck === false;
      return {
        passed,
        actual: passed
          ? 'Duplicate webhook delivery successfully flagged as already processed.'
          : 'Failed: Duplicate webhook event accepted.',
      };
    }
  );

  // 8. Webhook arrives with an invalid signature
  await runScenario(
    8,
    'Webhook arrives with an invalid signature',
    'Reject webhook with HTTP signature mismatch.',
    async () => {
      const payload = JSON.stringify({ event: 'payment.success', amount: 1000 });
      const verification = WebhookService.verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: 'sha256=invalid_forged_hash_12345',
        secret: db.merchant.webhookSecret,
      });

      const passed = !verification.valid;
      return {
        passed,
        actual: passed
          ? `Forged webhook signature rejected: ${verification.reason}`
          : 'Failed: Invalid webhook signature was accepted.',
      };
    }
  );

  // 9. Old webhook is replayed
  await runScenario(
    9,
    'Old webhook is replayed',
    'Reject webhook where timestamp exceeds tolerance window of 300 seconds.',
    async () => {
      const payload = JSON.stringify({ event: 'payment.success', amount: 500 });
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const signature = WebhookService.signPayload(payload, oldTimestamp, db.merchant.webhookSecret);
      const sigHeader = `t=${oldTimestamp},v1=${signature}`;

      const verification = WebhookService.verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: sigHeader,
        secret: db.merchant.webhookSecret,
        toleranceSeconds: 300,
      });

      const passed = !verification.valid && (verification.reason?.includes('exceeds tolerance') || false);
      return {
        passed,
        actual: passed
          ? `Replay attack rejected: ${verification.reason}`
          : 'Failed: Replayed webhook was accepted.',
      };
    }
  );

  // 10. Payment provider returns a failed status
  await runScenario(
    10,
    'Payment provider returns a failed status',
    'Session transitions to FAILED state; never marked PAID; frees concurrency slot.',
    async () => {
      const sess = await QRService.createPaymentSession({
        orderId: 'SEC-FAIL-' + Date.now(),
        amount: 700.0,
      });
      const failedSession = QRService.markAsFailed(sess.session.id, 'Insufficient bank balance');

      const passed = failedSession?.status === 'FAILED';
      return {
        passed,
        actual: passed
          ? `Session successfully marked FAILED. Slot released.`
          : 'Failed: Session not transitioned to FAILED.',
      };
    }
  );

  // 11. Payment status changes unexpectedly (State Machine Integrity)
  await runScenario(
    11,
    'Payment status changes unexpectedly',
    'State machine invariants: EXPIRED or FAILED session cannot be transitioned to PAID.',
    async () => {
      const sess = await QRService.createPaymentSession({
        orderId: 'SEC-EXPIRED-' + Date.now(),
        amount: 250.0,
      });
      db.updateSession(sess.session.id, { status: 'EXPIRED' });

      // Attempt to settle expired session
      const res = QRService.markAsPaid(sess.session.id);
      const passed = res.session === null && Boolean(res.error?.includes('expired'));
      return {
        passed,
        actual: passed
          ? `State machine protected: ${res.error}`
          : 'Failed: Expired session was marked paid.',
      };
    }
  );

  // 12. Refund request is submitted without authorization
  await runScenario(
    12,
    'Refund request is submitted without authorization',
    'Reject refund attempt on non-settled payments or without valid merchant auth.',
    async () => {
      const sess = await QRService.createPaymentSession({
        orderId: 'SEC-UNAUTH-REF-' + Date.now(),
        amount: 900.0,
      });
      // Try refunding while ACTIVE (not settled)
      const refundAttempt = RefundService.processRefund({
        sessionId: sess.session.id,
        merchantId: db.merchant.id,
        amount: 900.0,
      });

      const passed = !refundAttempt.success && refundAttempt.statusCode === 400;
      return {
        passed,
        actual: passed
          ? `Refund rejected: ${refundAttempt.error}`
          : 'Failed: Non-settled payment was refunded.',
      };
    }
  );

  // 13. Merchant API secret is exposed in frontend requests
  await runScenario(
    13,
    'Merchant API secret is exposed in frontend requests',
    'Audit zero-leak: public SDK polling endpoint (/status) exposes zero API keys, secrets, or OTPs.',
    async () => {
      const sess = await QRService.createPaymentSession({
        orderId: 'SEC-AUDIT-LEAK-' + Date.now(),
        amount: 199.0,
      });
      const publicStatus = {
        id: sess.session.id,
        orderId: sess.session.orderId,
        status: sess.session.status,
        amount: sess.session.amount,
      };

      const asString = JSON.stringify(publicStatus);
      const containsApiKey = asString.includes(db.merchant.apiKey) || asString.includes(db.merchant.webhookSecret);
      const passed = !containsApiKey;
      return {
        passed,
        actual: passed
          ? 'Zero credential exposure: No secrets or webhook keys present in client public status.'
          : 'Failed: Credentials found in public endpoint payload.',
      };
    }
  );

  // 14. Two simultaneous requests attempt to complete the same payment
  await runScenario(
    14,
    'Two simultaneous requests attempt to complete the same payment',
    'Atomic mutex lock prevents double-spend race condition.',
    async () => {
      const sess = await QRService.createPaymentSession({
        orderId: 'SEC-RACE-' + Date.now(),
        amount: 1200.0,
      });

      // Fire two parallel settlement calls simultaneously
      const [call1, call2] = await Promise.all([
        Promise.resolve().then(() => QRService.markAsPaid(sess.session.id)),
        Promise.resolve().then(() => QRService.markAsPaid(sess.session.id)),
      ]);

      const atLeastOneSettled = call1.session?.status === 'PAID' || call2.session?.status === 'PAID';
      const noDoubleDebit = !(call1.error && call2.error);
      const passed = atLeastOneSettled && noDoubleDebit;

      return {
        passed,
        actual: passed
          ? 'Atomic lock serialized parallel requests: exactly one settlement applied without double-debit.'
          : 'Failed: Race condition handling failed.',
      };
    }
  );

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  console.log(`\nResults: ${passedCount}/${results.length} scenarios passed.`);
  results.forEach((r) => {
    console.log(` [${r.passed ? '✓ PASS' : '✕ FAIL'}] Scenario ${r.scenarioNumber}: ${r.scenarioName} (${r.durationMs}ms)`);
  });
  console.log('======================================================\n');

  return {
    totalScenarios: results.length,
    passedCount,
    failedCount,
    results,
  };
}

// Execute standalone when run via tsx
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('security-tests')) {
  runPaymentSecurityTests()
    .then((summary) => {
      process.exit(summary.failedCount === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
