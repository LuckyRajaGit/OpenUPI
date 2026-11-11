import QRCode from 'qrcode';
import crypto from 'crypto';
import { db } from '../store.ts';
import { PaymentSession } from '../../src/types/index.ts';
import { QueueService } from './queueService.ts';
import { WebhookService } from './webhookService.ts';
import { logger } from './loggerService.ts';
import { redis } from './redisService.ts';

export class QRService {
  /**
   * Generate standardized NPCI UPI URI
   */
  public static generateUpiUri(params: {
    vpa: string;
    merchantName: string;
    amount: number;
    transactionRef: string;
    orderId: string;
    note?: string;
  }): string {
    const amountFormatted = params.amount.toFixed(2);
    const note = encodeURIComponent(params.note || `Order #${params.orderId}`);
    const name = encodeURIComponent(params.merchantName);
    
    // NPCI UPI Specification Compliant Deep-Link
    return `upi://pay?pa=${params.vpa}&pn=${name}&am=${amountFormatted}&tr=${params.transactionRef}&tn=${note}&cu=INR`;
  }

  /**
   * Generate Mobile Deep-link App Intents
   */
  public static generateAppIntents(upiUri: string) {
    const rawParams = upiUri.replace('upi://pay?', '');
    return {
      genericUpi: upiUri,
      gpay: `gpay://upi/pay?${rawParams}`,
      phonepe: `phonepe://pay?${rawParams}`,
      paytm: `paytmmp://pay?${rawParams}`,
      bhim: `bhim://pay?${rawParams}`,
    };
  }

  /**
   * Create dynamic QR payment session with database tracking, input validation, and idempotency checks
   */
  public static async createPaymentSession(params: {
    merchantId?: string;
    orderId: string;
    amount: number;
    currency?: string;
    customerName?: string;
    customerPhone?: string;
    isPhoneVerified?: boolean;
    method?: 'UPI_QR' | 'UPI_INTENT';
    idempotencyKey?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    session: PaymentSession;
    intents: ReturnType<typeof QRService.generateAppIntents>;
    isDuplicateReuse?: boolean;
  }> {
    const merchantId = params.merchantId || db.merchant.id;
    const merchant = db.getMerchant(merchantId) || db.merchant;

    // 1. Strict Input Validation (NPCI & Banking Rules)
    const rawAmount = Number(params.amount);
    if (isNaN(rawAmount) || rawAmount < 1.0) {
      throw new Error('Invalid payment amount: Minimum transaction is ₹1.00');
    }
    if (rawAmount > 100000.0) {
      throw new Error('Invalid payment amount: Exceeds NPCI maximum UPI limit of ₹100,000.00');
    }
    const cleanAmount = Math.round(rawAmount * 100) / 100;

    const cleanOrderId = (params.orderId || '').trim();
    if (!cleanOrderId || cleanOrderId.length < 2 || cleanOrderId.length > 64) {
      throw new Error('Invalid order ID: Must be between 2 and 64 alphanumeric characters');
    }

    // 2. Idempotency & duplicate check
    const dupCheck = QueueService.checkDuplicate(cleanOrderId, params.idempotencyKey);
    if (dupCheck.isDuplicate && dupCheck.existingSession) {
      // Amount manipulation prevention check!
      if (Math.abs(dupCheck.existingSession.amount - cleanAmount) > 0.001) {
        throw new Error(
          `Amount Tampering Detected: Order ${cleanOrderId} was originally initialized with ₹${dupCheck.existingSession.amount.toFixed(2)}, cannot be altered to ₹${cleanAmount.toFixed(2)}.`
        );
      }

      const intents = this.generateAppIntents(dupCheck.existingSession.upiUri);
      return {
        session: dupCheck.existingSession,
        intents,
        isDuplicateReuse: true,
      };
    }

    const sessionId = 'ses_' + crypto.randomBytes(8).toString('hex');
    const txnRef = 'OUP' + Date.now().toString().slice(-8) + crypto.randomBytes(2).toString('hex').toUpperCase();
    const expiresAt = Date.now() + (merchant.paymentTimeoutSeconds * 1000);

    const upiUri = this.generateUpiUri({
      vpa: merchant.vpa,
      merchantName: merchant.name,
      amount: cleanAmount,
      transactionRef: txnRef,
      orderId: cleanOrderId,
      note: `Payment for Order ${cleanOrderId}`,
    });

    // Generate crisp QR code data URL (SVG / PNG data URL)
    const qrDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const newSession: PaymentSession = {
      id: sessionId,
      orderId: cleanOrderId,
      merchantId: merchant.id,
      amount: cleanAmount,
      currency: params.currency || 'INR',
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      isPhoneVerified: !!params.isPhoneVerified,
      status: 'ACTIVE',
      method: params.method || 'UPI_QR',
      upiUri,
      qrDataUrl,
      createdAt: Date.now(),
      expiresAt,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    };

    // Save in database store
    db.createSession(newSession);

    // Evaluate concurrency queue
    QueueService.handleSessionQueue(newSession);

    const intents = this.generateAppIntents(upiUri);

    logger.info('PAYMENT_SESSION', `Created session ${sessionId} for order ${cleanOrderId} (₹${cleanAmount})`, {
      sessionId,
      orderId: cleanOrderId,
      merchantId: merchant.id,
      amount: cleanAmount,
    });

    return {
      session: newSession,
      intents,
    };
  }

  /**
   * Mark session as settled / paid with ATOMIC MUTEX LOCK to prevent double-spending race conditions
   */
  public static markAsPaid(sessionId: string, method: string = 'UPI'): { session: PaymentSession | null; error?: string } {
    // Acquire atomic distributed lock for this session
    const lockAcquired = redis.acquireLock(`settle:${sessionId}`, 10);
    if (!lockAcquired) {
      return {
        session: null,
        error: 'Race condition detected: Simultaneous settlement request in progress for this payment session.',
      };
    }

    try {
      const session = db.getSession(sessionId);
      if (!session) {
        return { session: null, error: 'Payment session not found' };
      }

      // If already settled, idempotently return existing settled state without duplicate execution
      if (session.status === 'PAID') {
        return { session };
      }

      // Enforce strict state machine: cannot mark EXPIRED or CANCELLED as PAID
      if (session.status === 'EXPIRED') {
        return { session: null, error: 'Cannot settle expired payment session' };
      }
      if (session.status === 'CANCELLED') {
        return { session: null, error: 'Cannot settle cancelled payment session' };
      }
      if (session.status === 'FAILED') {
        return { session: null, error: 'Cannot settle failed payment session' };
      }

      const updated = db.updateSession(sessionId, {
        status: 'PAID',
        paidAt: Date.now(),
        queuePosition: 0,
      });

      if (updated) {
        QueueService.releaseSlot(sessionId);

        logger.info('PAYMENT_SETTLED', `Settled session ${sessionId} for order ${updated.orderId} (₹${updated.amount})`, {
          sessionId,
          orderId: updated.orderId,
          merchantId: updated.merchantId,
          amount: updated.amount,
          method,
        });

        // Dispatch Signed Webhook Event to Merchant
        WebhookService.dispatchEvent(updated.merchantId, 'payment.success', {
          event: 'payment.success',
          sessionId: updated.id,
          orderId: updated.orderId,
          merchantId: updated.merchantId,
          amount: updated.amount,
          currency: updated.currency,
          paidAt: updated.paidAt,
          method,
          customerPhone: updated.customerPhone,
        });
      }

      return { session: updated || null };
    } finally {
      redis.releaseLock(`settle:${sessionId}`);
    }
  }

  /**
   * Mark session as failed (e.g., bank declined or customer rejected)
   */
  public static markAsFailed(sessionId: string, reason: string): PaymentSession | null {
    const session = db.getSession(sessionId);
    if (!session) return null;

    if (session.status === 'PAID') {
      logger.warn('PAYMENT_FAIL', `Attempted to fail an already settled payment (${sessionId}). Operation rejected.`);
      return session; // A paid payment cannot be marked failed
    }

    const updated = db.updateSession(sessionId, {
      status: 'FAILED',
    });

    if (updated) {
      QueueService.releaseSlot(sessionId);
      db.recordFailedPayment({
        orderId: updated.orderId,
        merchantId: updated.merchantId,
        amount: updated.amount,
        reason,
      });

      WebhookService.dispatchEvent(updated.merchantId, 'payment.failed', {
        event: 'payment.failed',
        sessionId: updated.id,
        orderId: updated.orderId,
        amount: updated.amount,
        reason,
      });
    }

    return updated || null;
  }
}
