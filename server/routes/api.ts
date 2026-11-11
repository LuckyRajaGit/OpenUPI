import express from 'express';
import { db } from '../store.ts';
import { QRService } from '../services/qrService.ts';
import { QueueService } from '../services/queueService.ts';
import { AuthService } from '../services/authService.ts';
import { CompanionService } from '../services/companionService.ts';
import { CODService } from '../services/codService.ts';
import { POSService } from '../services/posService.ts';
import { WhiteLabelService } from '../services/whiteLabelService.ts';
import { TestRunnerService } from '../services/testRunnerService.ts';

export const apiRouter = express.Router();

/* ==========================================================================
   MODULE 1 & 2: SESSIONS & DYNAMIC QR
   ========================================================================== */

// Create Payment Session
apiRouter.post('/sessions', async (req, res) => {
  try {
    const {
      amount,
      orderId,
      customerName,
      customerPhone,
      isPhoneVerified,
      method,
      idempotencyKey,
      metadata,
    } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    const effectiveOrderId = orderId || ('ORD_' + Date.now());

    const result = await QRService.createPaymentSession({
      amount: Number(amount),
      orderId: effectiveOrderId,
      customerName,
      customerPhone,
      isPhoneVerified,
      method,
      idempotencyKey,
      metadata,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// List Recent Payment Sessions
apiRouter.get('/sessions', (req, res) => {
  QueueService.cleanExpiredSessions();
  const allSessions = Array.from(db.sessions.values()).sort(
    (a, b) => b.createdAt - a.createdAt
  );
  res.json({ sessions: allSessions });
});

// Get Session Status (Optimized for SDK polling)
apiRouter.get('/sessions/:id/status', (req, res) => {
  QueueService.cleanExpiredSessions();
  const session = db.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({
    session: {
      id: session.id,
      orderId: session.orderId,
      status: session.status,
      queuePosition: session.queuePosition || 0,
      paidAt: session.paidAt,
      amount: session.amount,
      expiresAt: session.expiresAt,
    },
  });
});

// Get Full Session Detail
apiRouter.get('/sessions/:id', (req, res) => {
  QueueService.cleanExpiredSessions();
  const session = db.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ session });
});

// Mock Provider Pay Simulation
apiRouter.post('/sessions/:id/simulate-pay', (req, res) => {
  const session = QRService.markAsPaid(req.params.id, req.body.method || 'UPI_APP');
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ success: true, session });
});

/* ==========================================================================
   MODULE 3: PAYMENT QUEUE
   ========================================================================== */

apiRouter.get('/queue/status', (req, res) => {
  const status = QueueService.getQueueStatus();
  res.json(status);
});

apiRouter.post('/queue/config', (req, res) => {
  const { maxConcurrentPayments, paymentTimeoutSeconds } = req.body;
  if (maxConcurrentPayments !== undefined && Number(maxConcurrentPayments) > 0) {
    db.merchant.maxConcurrentPayments = Number(maxConcurrentPayments);
  }
  if (paymentTimeoutSeconds !== undefined && Number(paymentTimeoutSeconds) > 0) {
    db.merchant.paymentTimeoutSeconds = Number(paymentTimeoutSeconds);
  }
  QueueService.advanceQueue();
  res.json({
    success: true,
    config: {
      maxConcurrentPayments: db.merchant.maxConcurrentPayments,
      paymentTimeoutSeconds: db.merchant.paymentTimeoutSeconds,
    },
  });
});

/* ==========================================================================
   MODULE 4: AUTHENTICATION & PHONE OTP
   ========================================================================== */

// Create Customer Phone OTP Challenge (Never exposes OTP in response!)
apiRouter.post('/auth/customer-phone/challenge', (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }
  const result = AuthService.createPhoneChallenge(phone);
  res.json(result);
});

// Verify Customer OTP Challenge
apiRouter.post('/auth/customer-phone/verify', (req, res) => {
  const { challengeId, otp } = req.body;
  if (!challengeId || !otp) {
    return res.status(400).json({ error: 'challengeId and otp are required' });
  }
  const result = AuthService.verifyPhoneChallenge(challengeId, otp);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Developer Mock Carrier SMS Inbox Simulator (For testing only)
apiRouter.get('/auth/mock-sms-inbox', (req, res) => {
  const challenges = Array.from(db.phoneChallenges.entries()).map(([id, c]) => ({
    challengeId: id,
    phoneMasked: c.phone.slice(0, 4) + '****' + c.phone.slice(-2),
    rawPhone: c.phone,
    mockSmsContent: `[OpenUPI] Your verification code is ${c.rawOtp}. Do not share this with anyone. Expires in 5 minutes.`,
    expiresInSec: Math.max(0, Math.round((c.expiresAt - Date.now()) / 1000)),
    verified: c.verified,
  }));
  res.json({ inbox: challenges.reverse() });
});

// Merchant Auth Profile
apiRouter.get('/auth/merchant', (req, res) => {
  res.json({
    merchantId: db.merchant.id,
    name: db.merchant.name,
    vpa: db.merchant.vpa,
    apiKeyMasked: db.merchant.apiKey.slice(0, 8) + '...' + db.merchant.apiKey.slice(-4),
    mockMode: db.merchant.mockMode,
  });
});

/* ==========================================================================
   MODULE 5: ANDROID COMPANION
   ========================================================================== */

apiRouter.get('/companion/devices', (req, res) => {
  const devices = Array.from(db.androidDevices.values());
  res.json({ devices });
});

apiRouter.post('/companion/enroll', (req, res) => {
  const { deviceName, model, firmwareVersion } = req.body;
  if (!deviceName || !model) {
    return res.status(400).json({ error: 'deviceName and model are required' });
  }
  const result = CompanionService.enrollDevice({ deviceName, model, firmwareVersion });
  res.json(result);
});

apiRouter.post('/companion/heartbeat', (req, res) => {
  const { deviceId, batteryPercent, isCharging, batteryTempC, networkType } = req.body;
  const updated = CompanionService.recordHeartbeat(deviceId, {
    batteryPercent: batteryPercent ?? 85,
    isCharging: !!isCharging,
    batteryTempC: batteryTempC ?? 32,
    networkType: networkType || 'WIFI',
  });
  if (!updated) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json({ success: true, device: updated });
});

apiRouter.post('/companion/observations', (req, res) => {
  const { deviceId, rawSender, detectedAmount, referenceId, signature, matchedSessionId } = req.body;
  if (!deviceId || !detectedAmount) {
    return res.status(400).json({ error: 'deviceId and detectedAmount are required' });
  }
  const result = CompanionService.ingestObservation({
    deviceId,
    rawSender: rawSender || 'BANK-UPI-ALERT',
    detectedAmount: Number(detectedAmount),
    referenceId: referenceId || ('REF_' + Date.now()),
    signature: signature || ('sig_' + Date.now()),
    matchedSessionId,
  });
  res.json(result);
});

apiRouter.get('/companion/observations', (req, res) => {
  res.json({ observations: db.companionObservations });
});

apiRouter.get('/companion/blueprint', (req, res) => {
  const blueprint = CompanionService.getKotlinArchitectureBlueprint();
  res.json(blueprint);
});

/* ==========================================================================
   MODULE 6: COD (CASH ON DELIVERY)
   ========================================================================== */

apiRouter.get('/cod/orders', (req, res) => {
  const orders = Array.from(db.codOrders.values()).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ orders });
});

apiRouter.post('/cod/orders', (req, res) => {
  const { orderId, customerName, phone, deliveryAddress, pincode, items, codFee } = req.body;
  if (!customerName || !phone || !deliveryAddress || !items || !items.length) {
    return res.status(400).json({ error: 'Missing mandatory COD fields' });
  }
  const order = CODService.createOrder({
    orderId: orderId || ('COD_' + Date.now()),
    customerName,
    phone,
    deliveryAddress,
    pincode: pincode || '560001',
    items,
    codFee,
  });
  res.json({ success: true, order });
});

apiRouter.post('/cod/orders/:orderId/approval', (req, res) => {
  const { approved, rejectReason } = req.body;
  const order = CODService.updateMerchantApproval(req.params.orderId, !!approved, rejectReason);
  if (!order) {
    return res.status(404).json({ error: 'COD order not found' });
  }
  res.json({ success: true, order });
});

apiRouter.post('/cod/orders/:orderId/delivery', (req, res) => {
  const { status, courierPartner, trackingNumber } = req.body;
  const order = CODService.updateDeliveryStatus(req.params.orderId, status, {
    courierPartner: courierPartner || 'BlueDart Air',
    trackingNumber: trackingNumber || ('BD' + Math.floor(10000000 + Math.random() * 90000000)),
  });
  if (!order) {
    return res.status(404).json({ error: 'COD order not found' });
  }
  res.json({ success: true, order });
});

apiRouter.get('/cod/report', (req, res) => {
  const report = CODService.getCODReport();
  res.json(report);
});

/* ==========================================================================
   MODULE 7: OFFLINE POS
   ========================================================================== */

apiRouter.get('/pos/summary', (req, res) => {
  const summary = POSService.getShiftSummary();
  res.json(summary);
});

apiRouter.get('/pos/transactions', (req, res) => {
  res.json({ transactions: db.posTransactions });
});

apiRouter.post('/pos/transactions', (req, res) => {
  const { items, splitTender, cashierName } = req.body;
  if (!items || !items.length || !splitTender) {
    return res.status(400).json({ error: 'items and splitTender are required' });
  }
  const transaction = POSService.recordTransaction({
    items,
    splitTender,
    cashierName,
  });
  res.json({ success: true, transaction });
});

apiRouter.post('/pos/edc/charge', (req, res) => {
  const { amount } = req.body;
  const terminalState = POSService.triggerCardTerminal(Number(amount || 0));
  res.json(terminalState);
});

apiRouter.post('/pos/edc/reset', (req, res) => {
  const terminalState = POSService.resetCardTerminal();
  res.json(terminalState);
});

/* ==========================================================================
   MODULE 8: WHITE-LABEL CONFIGURATION
   ========================================================================== */

apiRouter.get('/white-label', (req, res) => {
  res.json({
    config: WhiteLabelService.getBranding(),
    cssVariables: WhiteLabelService.generateCssVariables(),
  });
});

apiRouter.post('/white-label', (req, res) => {
  const updated = WhiteLabelService.updateBranding(req.body);
  res.json({
    success: true,
    config: updated,
    cssVariables: WhiteLabelService.generateCssVariables(),
  });
});

apiRouter.post('/white-label/verify-domain', (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  const result = WhiteLabelService.verifyCustomDomain(domain);
  res.json(result);
});

/* ==========================================================================
   MODULE 9: DEVELOPER EXPERIENCE & TEST RUNNER
   ========================================================================== */

apiRouter.get('/developer/webhooks', (req, res) => {
  res.json({ logs: db.webhookLogs });
});

apiRouter.post('/developer/webhooks/test-dispatch', (req, res) => {
  const testLog = {
    id: 'wh_test_' + Date.now().toString().slice(-6),
    event: 'payment.success',
    payload: {
      event: 'payment.success',
      orderId: 'ORD_TEST_998',
      amount: 499.0,
      upiVpa: db.merchant.vpa,
      settlementTime: new Date().toISOString(),
    },
    status: 200,
    timestamp: Date.now(),
    signature: 'sha256_mock_sig_' + Date.now(),
  };
  db.webhookLogs.unshift(testLog);
  res.json({ success: true, log: testLog });
});

apiRouter.get('/developer/postman', (req, res) => {
  const host = `${req.protocol}://${req.get('host')}`;
  const postmanCollection = {
    info: {
      name: 'OpenUPI Gateway API Collection',
      description: 'Complete API endpoints for OpenUPI Gateway self-hosted UPI payments.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      {
        name: 'Sessions',
        item: [
          {
            name: 'Create Payment Session',
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              url: `${host}/api/v1/sessions`,
              body: {
                mode: 'raw',
                raw: JSON.stringify({ amount: 499.0, orderId: 'ORD-101', method: 'UPI_QR' }, null, 2),
              },
            },
          },
          {
            name: 'Get Session Status',
            request: {
              method: 'GET',
              url: `${host}/api/v1/sessions/{{sessionId}}/status`,
            },
          },
        ],
      },
      {
        name: 'Android Companion',
        item: [
          {
            name: 'Device Heartbeat',
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              url: `${host}/api/v1/companion/heartbeat`,
              body: {
                mode: 'raw',
                raw: JSON.stringify({ deviceId: 'AND-NODE-01', batteryPercent: 92, isCharging: true }, null, 2),
              },
            },
          },
          {
            name: 'Ingest Observation',
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              url: `${host}/api/v1/companion/observations`,
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  deviceId: 'AND-NODE-01',
                  rawSender: 'AXISBK-UPI',
                  detectedAmount: 499.0,
                  referenceId: 'UPI-984102',
                  signature: 'sig_test',
                }, null, 2),
              },
            },
          },
        ],
      },
      {
        name: 'Offline POS',
        item: [
          {
            name: 'Record POS Transaction',
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              url: `${host}/api/v1/pos/transactions`,
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  items: [{ name: 'Espresso Beans', qty: 1, price: 450 }],
                  splitTender: { cashAmount: 450, cashTendered: 500, changeReturned: 50, cardAmount: 0, upiAmount: 0 },
                }, null, 2),
              },
            },
          },
        ],
      },
    ],
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="openupi_postman_collection.json"');
  res.send(JSON.stringify(postmanCollection, null, 2));
});

// Automated Test Runner Endpoint
apiRouter.post('/tests/run', async (req, res) => {
  try {
    const testResults = await TestRunnerService.runAllTests();
    res.json(testResults);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Test suite execution failed' });
  }
});
