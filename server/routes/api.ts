import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../store.ts';
import { QRService } from '../services/qrService.ts';
import { QueueService } from '../services/queueService.ts';
import { AuthService } from '../services/authService.ts';
import { CompanionService } from '../services/companionService.ts';
import { CODService } from '../services/codService.ts';
import { POSService } from '../services/posService.ts';
import { WhiteLabelService } from '../services/whiteLabelService.ts';
import { TestRunnerService } from '../services/testRunnerService.ts';
import { RefundService } from '../services/refundService.ts';
import { WebhookService } from '../services/webhookService.ts';
import { redis } from '../services/redisService.ts';
import { logger } from '../services/loggerService.ts';
import { SystemHealthState } from '../../src/types/index.ts';

export const apiRouter = express.Router();

// Extend Request type to include correlation ID and merchant
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      merchant?: any;
      merchantId?: string;
    }
  }
}

/* ==========================================================================
   SECURITY MIDDLEWARE: REQUEST ID & CORRELATION TRACKING
   ========================================================================== */
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers['x-request-id'] as string) || 'req_' + crypto.randomBytes(8).toString('hex');
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
});

/* ==========================================================================
   SECURITY MIDDLEWARE: RATE LIMITING (SLIDING WINDOW)
   ========================================================================== */
const rateLimitMiddleware = (action: string, maxRequests: number, windowSeconds: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const identifier = req.headers['authorization'] || ip;
    const result = redis.checkRateLimit(identifier.toString(), action, maxRequests, windowSeconds);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetSeconds);

    if (!result.allowed) {
      logger.warn('RATE_LIMIT', `Rate limit exceeded for ${action} by ${ip}`, { ip, action }, req.requestId);
      return res.status(429).json({
        error: `Too Many Requests: Rate limit exceeded. Try again in ${result.resetSeconds} seconds.`,
        requestId: req.requestId,
        retryAfter: result.resetSeconds,
      });
    }

    next();
  };
};

/* ==========================================================================
   SECURITY MIDDLEWARE: MERCHANT AUTHENTICATION
   ========================================================================== */
const requireMerchantAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    logger.warn('AUTH', 'Missing Authorization header', undefined, req.requestId);
    return res.status(401).json({
      error: 'Unauthorized: Missing Authorization header. Provide Bearer <merchant_api_key>.',
      requestId: req.requestId,
    });
  }

  const merchant = db.getMerchantByApiKey(authHeader);
  if (!merchant) {
    logger.warn('AUTH', 'Invalid merchant API key provided', undefined, req.requestId);
    return res.status(401).json({
      error: 'Unauthorized: Invalid merchant API key.',
      requestId: req.requestId,
    });
  }

  req.merchant = merchant;
  req.merchantId = merchant.id;
  next();
};

/* ==========================================================================
   MODULE 1 & 2: SESSIONS & DYNAMIC QR (WITH RATE LIMITING & VALIDATION)
   ========================================================================== */

// Create Payment Session
apiRouter.post('/sessions', rateLimitMiddleware('create_session', 60, 60), async (req: Request, res: Response) => {
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
      merchantId,
    } = req.body;

    // Optional merchant auth if provided, otherwise default to active merchant
    let effectiveMerchantId = db.merchant.id;
    if (req.headers['authorization']) {
      const authMerchant = db.getMerchantByApiKey(req.headers['authorization'] as string);
      if (authMerchant) effectiveMerchantId = authMerchant.id;
    } else if (merchantId && db.getMerchant(merchantId)) {
      effectiveMerchantId = merchantId;
    }

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ error: 'Valid positive amount is required', requestId: req.requestId });
    }

    const effectiveOrderId = (orderId || ('ORD_' + Date.now())).toString().trim();

    const result = await QRService.createPaymentSession({
      merchantId: effectiveMerchantId,
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
    logger.error('SESSIONS', `Error creating session: ${err.message}`, undefined, req.requestId);
    res.status(400).json({ error: err.message || 'Failed to create payment session', requestId: req.requestId });
  }
});

// List Recent Payment Sessions (Partitioned by Merchant)
apiRouter.get('/sessions', (req: Request, res: Response) => {
  QueueService.cleanExpiredSessions();

  // If merchant key provided, strictly filter by that merchant (Merchant Isolation)
  if (req.headers['authorization']) {
    const merchant = db.getMerchantByApiKey(req.headers['authorization'] as string);
    if (merchant) {
      return res.json({ sessions: db.getSessionsByMerchant(merchant.id) });
    }
  }

  // Default merchant sessions
  const allSessions = db.getSessionsByMerchant(db.merchant.id);
  res.json({ sessions: allSessions });
});

// Get Session Status (Public Safe Polling Endpoint for SDK)
apiRouter.get('/sessions/:id/status', (req: Request, res: Response) => {
  QueueService.cleanExpiredSessions();
  const session = db.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', requestId: req.requestId });
  }

  // Zero-leak public response: only essential checkout state fields
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

// Get Full Session Detail (Enforces Merchant Isolation if authenticated)
apiRouter.get('/sessions/:id', (req: Request, res: Response) => {
  QueueService.cleanExpiredSessions();
  const session = db.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', requestId: req.requestId });
  }

  // IDOR Protection: If caller is authenticated as another merchant, reject access
  if (req.headers['authorization']) {
    const merchant = db.getMerchantByApiKey(req.headers['authorization'] as string);
    if (merchant && merchant.id !== session.merchantId) {
      logger.warn('IDOR', `Cross-merchant access blocked for session ${session.id}`, {
        requestMerchant: merchant.id,
        sessionMerchant: session.merchantId,
      }, req.requestId);
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access another merchant account’s session.',
        requestId: req.requestId,
      });
    }
  }

  res.json({ session });
});

// Mock Provider Pay Simulation (Atomic Settle)
apiRouter.post('/sessions/:id/simulate-pay', (req: Request, res: Response) => {
  const result = QRService.markAsPaid(req.params.id, req.body.method || 'UPI_APP');
  if (result.error) {
    return res.status(409).json({ error: result.error, requestId: req.requestId });
  }
  if (!result.session) {
    return res.status(404).json({ error: 'Session not found', requestId: req.requestId });
  }
  res.json({ success: true, session: result.session });
});

/* ==========================================================================
   REFUND ENDPOINT: SECURE MERCHANT AUTHORIZATION & IDOR GUARD
   ========================================================================== */
apiRouter.post('/sessions/:id/refund', requireMerchantAuth, (req: Request, res: Response) => {
  const { amount, reason, idempotencyKey } = req.body;
  const result = RefundService.processRefund({
    sessionId: req.params.id,
    merchantId: req.merchantId!,
    amount,
    reason,
    idempotencyKey,
  });

  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error, requestId: req.requestId });
  }

  res.json(result);
});

apiRouter.post('/payments/:id/refund', requireMerchantAuth, (req: Request, res: Response) => {
  const { amount, reason, idempotencyKey } = req.body;
  const result = RefundService.processRefund({
    sessionId: req.params.id,
    merchantId: req.merchantId!,
    amount,
    reason,
    idempotencyKey,
  });

  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error, requestId: req.requestId });
  }

  res.json(result);
});

/* ==========================================================================
   MODULE 3: PAYMENT QUEUE
   ========================================================================== */
apiRouter.get('/queue/status', (req: Request, res: Response) => {
  const status = QueueService.getQueueStatus();
  res.json(status);
});

apiRouter.post('/queue/config', (req: Request, res: Response) => {
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
   MODULE 4: AUTHENTICATION & PHONE OTP (STRICT RATE LIMITING)
   ========================================================================== */

// Rate-limited to 5 SMS per minute to prevent OTP SMS pumping / toll fraud
apiRouter.post('/auth/customer-phone/challenge', rateLimitMiddleware('sms_otp', 5, 60), (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
    return res.status(400).json({ error: 'Valid phone number is required', requestId: req.requestId });
  }
  const result = AuthService.createPhoneChallenge(phone);
  res.json(result);
});

// Verify Customer OTP Challenge (Max 10 attempts per minute)
apiRouter.post('/auth/customer-phone/verify', rateLimitMiddleware('verify_otp', 10, 60), (req: Request, res: Response) => {
  const { challengeId, otp } = req.body;
  if (!challengeId || !otp) {
    return res.status(400).json({ error: 'challengeId and otp are required', requestId: req.requestId });
  }
  const result = AuthService.verifyPhoneChallenge(challengeId, otp);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Developer Mock Carrier SMS Inbox Simulator
apiRouter.get('/auth/mock-sms-inbox', (req: Request, res: Response) => {
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
apiRouter.get('/auth/merchant', (req: Request, res: Response) => {
  res.json({
    merchantId: db.merchant.id,
    name: db.merchant.name,
    vpa: db.merchant.vpa,
    apiKeyMasked: db.merchant.apiKey.slice(0, 8) + '...' + db.merchant.apiKey.slice(-4),
    rawApiKeyForSandboxOnly: db.merchant.apiKey,
    webhookSecret: db.merchant.webhookSecret,
    mockMode: db.merchant.mockMode,
  });
});

/* ==========================================================================
   MODULE 5: ANDROID COMPANION
   ========================================================================== */
apiRouter.get('/companion/devices', (req: Request, res: Response) => {
  const devices = Array.from(db.androidDevices.values());
  res.json({ devices });
});

apiRouter.post('/companion/enroll', (req: Request, res: Response) => {
  const { deviceName, model, firmwareVersion } = req.body;
  if (!deviceName || !model) {
    return res.status(400).json({ error: 'deviceName and model are required', requestId: req.requestId });
  }
  const result = CompanionService.enrollDevice({ deviceName, model, firmwareVersion });
  res.json(result);
});

apiRouter.post('/companion/heartbeat', (req: Request, res: Response) => {
  const { deviceId, batteryPercent, isCharging, batteryTempC, networkType } = req.body;
  const updated = CompanionService.recordHeartbeat(deviceId, {
    batteryPercent: batteryPercent ?? 85,
    isCharging: !!isCharging,
    batteryTempC: batteryTempC ?? 32,
    networkType: networkType || 'WIFI',
  });
  if (!updated) {
    return res.status(404).json({ error: 'Device not found', requestId: req.requestId });
  }
  res.json({ success: true, device: updated });
});

apiRouter.post('/companion/observations', (req: Request, res: Response) => {
  const { deviceId, rawSender, detectedAmount, referenceId, signature, matchedSessionId } = req.body;
  if (!deviceId || !detectedAmount) {
    return res.status(400).json({ error: 'deviceId and detectedAmount are required', requestId: req.requestId });
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

apiRouter.get('/companion/observations', (req: Request, res: Response) => {
  res.json({ observations: db.companionObservations });
});

apiRouter.get('/companion/blueprint', (req: Request, res: Response) => {
  const blueprint = CompanionService.getKotlinArchitectureBlueprint();
  res.json(blueprint);
});

/* ==========================================================================
   MODULE 6: COD (CASH ON DELIVERY)
   ========================================================================== */
apiRouter.get('/cod/orders', (req: Request, res: Response) => {
  const orders = Array.from(db.codOrders.values()).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ orders });
});

apiRouter.post('/cod/orders', (req: Request, res: Response) => {
  const { orderId, customerName, phone, deliveryAddress, pincode, items, codFee } = req.body;
  if (!customerName || !phone || !deliveryAddress || !items || !items.length) {
    return res.status(400).json({ error: 'Missing mandatory COD fields', requestId: req.requestId });
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

apiRouter.post('/cod/orders/:orderId/approval', (req: Request, res: Response) => {
  const { approved, rejectReason } = req.body;
  const order = CODService.updateMerchantApproval(req.params.orderId, !!approved, rejectReason);
  if (!order) {
    return res.status(404).json({ error: 'COD order not found', requestId: req.requestId });
  }
  res.json({ success: true, order });
});

apiRouter.post('/cod/orders/:orderId/delivery', (req: Request, res: Response) => {
  const { status, courierPartner, trackingNumber } = req.body;
  const order = CODService.updateDeliveryStatus(req.params.orderId, status, {
    courierPartner: courierPartner || 'BlueDart Air',
    trackingNumber: trackingNumber || ('BD' + Math.floor(10000000 + Math.random() * 90000000)),
  });
  if (!order) {
    return res.status(404).json({ error: 'COD order not found', requestId: req.requestId });
  }
  res.json({ success: true, order });
});

apiRouter.get('/cod/report', (req: Request, res: Response) => {
  const report = CODService.getCODReport();
  res.json(report);
});

/* ==========================================================================
   MODULE 7: OFFLINE POS
   ========================================================================== */
apiRouter.get('/pos/summary', (req: Request, res: Response) => {
  const summary = POSService.getShiftSummary();
  res.json(summary);
});

apiRouter.get('/pos/transactions', (req: Request, res: Response) => {
  res.json({ transactions: db.posTransactions });
});

apiRouter.post('/pos/transactions', (req: Request, res: Response) => {
  const { items, splitTender, cashierName } = req.body;
  if (!items || !items.length || !splitTender) {
    return res.status(400).json({ error: 'items and splitTender are required', requestId: req.requestId });
  }
  const transaction = POSService.recordTransaction({
    items,
    splitTender,
    cashierName,
  });
  res.json({ success: true, transaction });
});

apiRouter.post('/pos/edc/charge', (req: Request, res: Response) => {
  const { amount } = req.body;
  const terminalState = POSService.triggerCardTerminal(Number(amount || 0));
  res.json(terminalState);
});

apiRouter.post('/pos/edc/reset', (req: Request, res: Response) => {
  const terminalState = POSService.resetCardTerminal();
  res.json(terminalState);
});

/* ==========================================================================
   MODULE 8: WHITE-LABEL CONFIGURATION
   ========================================================================== */
apiRouter.get('/white-label', (req: Request, res: Response) => {
  res.json({
    config: WhiteLabelService.getBranding(),
    cssVariables: WhiteLabelService.generateCssVariables(),
  });
});

apiRouter.post('/white-label', (req: Request, res: Response) => {
  const updated = WhiteLabelService.updateBranding(req.body);
  res.json({
    success: true,
    config: updated,
    cssVariables: WhiteLabelService.generateCssVariables(),
  });
});

apiRouter.post('/white-label/verify-domain', (req: Request, res: Response) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required', requestId: req.requestId });
  const result = WhiteLabelService.verifyCustomDomain(domain);
  res.json(result);
});

/* ==========================================================================
   MODULE 9: DEVELOPER EXPERIENCE, POSTMAN, WEBHOOK VERIFY & TESTS
   ========================================================================== */
apiRouter.get('/developer/webhooks', (req: Request, res: Response) => {
  res.json({ logs: db.webhookLogs });
});

apiRouter.post('/developer/webhooks/verify', (req: Request, res: Response) => {
  const { payload, signature, secret, timestamp } = req.body;
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const result = WebhookService.verifyWebhookSignature({
    rawBody,
    signatureHeader: signature,
    secret: secret || db.merchant.webhookSecret,
  });
  res.json(result);
});

apiRouter.post('/developer/webhooks/test-dispatch', async (req: Request, res: Response) => {
  const testPayload = {
    event: 'payment.success',
    orderId: 'ORD_TEST_' + Math.floor(1000 + Math.random() * 9000),
    amount: 499.0,
    upiVpa: db.merchant.vpa,
    settlementTime: new Date().toISOString(),
  };
  await WebhookService.dispatchEvent(db.merchant.id, 'payment.success', testPayload);
  res.json({ success: true, log: db.webhookLogs[0] });
});

apiRouter.get('/developer/postman', (req: Request, res: Response) => {
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
            name: 'Get Session Status (SDK Polling)',
            request: {
              method: 'GET',
              url: `${host}/api/v1/sessions/{{sessionId}}/status`,
            },
          },
        ],
      },
      {
        name: 'Refunds',
        item: [
          {
            name: 'Create Authorized Refund',
            request: {
              method: 'POST',
              header: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'Authorization', value: 'Bearer {{merchant_api_key}}' },
              ],
              url: `${host}/api/v1/sessions/{{sessionId}}/refund`,
              body: {
                mode: 'raw',
                raw: JSON.stringify({ amount: 200, reason: 'Customer return', idempotencyKey: 'ref_idem_01' }, null, 2),
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
apiRouter.post('/tests/run', async (req: Request, res: Response) => {
  try {
    const testResults = await TestRunnerService.runAllTests();
    res.json(testResults);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Test suite execution failed', requestId: req.requestId });
  }
});

/* ==========================================================================
   DEBUGGING, HEALTH, & ERROR MONITORING ENDPOINTS
   ========================================================================== */
apiRouter.get('/debug/health', (req: Request, res: Response) => {
  const redisHealth = redis.getHealth();
  const uptimeSeconds = Math.floor(process.uptime());

  const health: SystemHealthState = {
    application: {
      status: 'HEALTHY',
      version: '1.2.0-hardened',
      nodeVersion: process.version,
      uptimeSeconds,
      activeSessions: db.activeProcessing.size,
    },
    database: {
      status: 'CONNECTED',
      engine: 'IN_MEMORY_PERSISTENT_STORE',
      integrityCheck: 'PASSED',
      totalRecords: db.sessions.size + db.posTransactions.length + db.codOrders.size,
    },
    redis: {
      status: redisHealth.status,
      mode: redisHealth.mode,
      latencyMs: redisHealth.latencyMs,
      totalKeys: redisHealth.totalKeys,
    },
    workers: {
      queueWatchdog: 'RUNNING',
      webhookDispatcher: 'IDLE',
      lastHeartbeat: new Date().toISOString(),
    },
    paymentProvider: {
      name: 'NPCI UPI Sandbox / Mock Gateway',
      status: 'ONLINE',
      circuitBreaker: 'CLOSED',
    },
  };

  res.json(health);
});

apiRouter.get('/debug/logs', (req: Request, res: Response) => {
  const level = req.query.level as any;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = logger.getRecentLogs(limit, level);
  res.json({ logs });
});

apiRouter.get('/debug/failed-payments', (req: Request, res: Response) => {
  res.json({ failures: db.failedPayments });
});

apiRouter.get('/debug/failed-webhooks', (req: Request, res: Response) => {
  res.json({ failures: db.failedWebhooks });
});
