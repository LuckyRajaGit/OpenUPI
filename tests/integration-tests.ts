import { QRService } from '../server/services/qrService.ts';
import { QueueService } from '../server/services/queueService.ts';
import { AuthService } from '../server/services/authService.ts';
import { CompanionService } from '../server/services/companionService.ts';
import { CODService } from '../server/services/codService.ts';
import { POSService } from '../server/services/posService.ts';
import { WhiteLabelService } from '../server/services/whiteLabelService.ts';
import { RefundService } from '../server/services/refundService.ts';
import { WebhookService } from '../server/services/webhookService.ts';
import { db } from '../server/store.ts';

export async function runIntegrationTests(): Promise<{
  totalTests: number;
  passedCount: number;
  failedCount: number;
  results: Array<{ testName: string; passed: boolean; details: string; durationMs: number }>;
}> {
  const results: Array<{ testName: string; passed: boolean; details: string; durationMs: number }> = [];

  const runTest = (name: string, fn: () => void | Promise<void>) => {
    const t0 = Date.now();
    try {
      fn();
      results.push({ testName: name, passed: true, details: 'OK', durationMs: Date.now() - t0 });
    } catch (err: any) {
      results.push({ testName: name, passed: false, details: err.message, durationMs: Date.now() - t0 });
    }
  };

  console.log('\n======================================================');
  console.log('🧪 OpenUPI Gateway: Running Core Integration Tests');
  console.log('======================================================\n');

  // 1. Session & Dynamic QR creation
  runTest('Dynamic QR creates valid session and NPCI intent URI', async () => {
    const s = await QRService.createPaymentSession({ orderId: 'INT-ORD-1', amount: 99.0 });
    if (!s.session.upiUri.includes('upi://pay?pa=')) throw new Error('Invalid UPI URI');
    if (!s.session.qrDataUrl.startsWith('data:image/')) throw new Error('Invalid QR Data URL');
  });

  // 2. Queue concurrency limiter
  runTest('Payment Queue enforces slot limit and queues excess sessions', async () => {
    const prevConcurrency = db.merchant.maxConcurrentPayments;
    db.merchant.maxConcurrentPayments = 1;
    try {
      const s1 = await QRService.createPaymentSession({ orderId: 'INT-Q-1', amount: 50.0 });
      const s2 = await QRService.createPaymentSession({ orderId: 'INT-Q-2', amount: 60.0 });
      if (s1.session.status !== 'ACTIVE') throw new Error('Session 1 should be ACTIVE');
      if (s2.session.status !== 'QUEUED') throw new Error('Session 2 should be QUEUED');
    } finally {
      db.merchant.maxConcurrentPayments = prevConcurrency;
    }
  });

  // 3. Customer phone OTP zero-leak
  runTest('Auth service generates OTP challenge without secret in client return', () => {
    const challenge = AuthService.createPhoneChallenge('+91 98999 44444');
    // @ts-ignore
    if (challenge.rawOtp || challenge.otp) throw new Error('Raw OTP leaked in challenge response!');
  });

  // 4. Android companion settlement separation
  runTest('Android companion observation is strictly marked UNVERIFIED', () => {
    const obs = CompanionService.ingestObservation({
      deviceId: 'AND-NODE-KOTLIN-01',
      rawSender: 'HDFCBK-UPI',
      detectedAmount: 500,
      referenceId: 'REF-99',
      signature: 'test_sig',
    });
    if (obs.observation.settlementStatus !== 'OBSERVED_UNVERIFIED') {
      throw new Error('Observations must never be marked settled directly!');
    }
  });

  // 5. COD approval workflow
  runTest('COD service handles order lifecycle and merchant approval', () => {
    const order = CODService.createOrder({
      orderId: 'INT-COD-' + Date.now(),
      customerName: 'Test Buyer',
      phone: '+91 98000 11111',
      deliveryAddress: 'Test Address',
      pincode: '560001',
      items: [{ name: 'Item', quantity: 1, price: 300 }],
    });
    const approved = CODService.updateMerchantApproval(order.orderId, true);
    if (approved?.status !== 'MERCHANT_APPROVED') throw new Error('Expected MERCHANT_APPROVED');
  });

  // 6. POS Split Tender
  runTest('POS service records cash and card split transactions', () => {
    const txn = POSService.recordTransaction({
      items: [{ name: 'Test Drink', qty: 1, price: 100 }],
      splitTender: {
        cashAmount: 50,
        cashTendered: 100,
        changeReturned: 50,
        cardAmount: 55, // 100 + 5% tax = 105
        upiAmount: 0,
      },
    });
    if (txn.total !== 105) throw new Error(`Expected total 105, got ${txn.total}`);
  });

  // 7. Partial & Full Refunds
  runTest('Refund service processes partial and full refunds with idempotency', async () => {
    const s = await QRService.createPaymentSession({ orderId: 'INT-REF-' + Date.now(), amount: 1000.0 });
    QRService.markAsPaid(s.session.id);

    // Partial refund ₹400
    const r1 = RefundService.processRefund({
      sessionId: s.session.id,
      merchantId: s.session.merchantId,
      amount: 400.0,
      idempotencyKey: 'IDEMP_REF_1_' + Date.now(),
    });
    if (!r1.success || r1.session?.status !== 'PARTIALLY_REFUNDED') {
      throw new Error('Partial refund failed');
    }

    // Remaining refund ₹600
    const r2 = RefundService.processRefund({
      sessionId: s.session.id,
      merchantId: s.session.merchantId,
      amount: 600.0,
      idempotencyKey: 'IDEMP_REF_2_' + Date.now(),
    });
    if (!r2.success || r2.session?.status !== 'REFUNDED') {
      throw new Error('Full refund failed');
    }
  });

  // 8. Webhook Signature Generation & Verification
  runTest('Webhook service signs and verifies payloads with timing-safe HMAC', () => {
    const payload = JSON.stringify({ event: 'test.event', time: Date.now() });
    const now = Math.floor(Date.now() / 1000);
    const sig = WebhookService.signPayload(payload, now, 'test_secret_123');
    const header = `t=${now},v1=${sig}`;

    const check = WebhookService.verifyWebhookSignature({
      rawBody: payload,
      signatureHeader: header,
      secret: 'test_secret_123',
    });
    if (!check.valid) throw new Error('Valid webhook signature was rejected');
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  console.log(`\nResults: ${passedCount}/${results.length} integration tests passed.`);
  results.forEach((r) => {
    console.log(` [${r.passed ? '✓ PASS' : '✕ FAIL'}] ${r.testName} (${r.durationMs}ms)`);
  });
  console.log('======================================================\n');

  return {
    totalTests: results.length,
    passedCount,
    failedCount,
    results,
  };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('integration-tests')) {
  runIntegrationTests()
    .then((summary) => {
      process.exit(summary.failedCount === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
