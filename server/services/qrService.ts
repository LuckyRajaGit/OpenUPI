import QRCode from 'qrcode';
import crypto from 'crypto';
import { db } from '../store.ts';
import { PaymentSession } from '../../src/types/index.ts';
import { QueueService } from './queueService.ts';

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
   * Create dynamic QR payment session with database tracking and queue limit check
   */
  public static async createPaymentSession(params: {
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
    // 1. Idempotency & duplicate check
    const dupCheck = QueueService.checkDuplicate(params.orderId, params.idempotencyKey);
    if (dupCheck.isDuplicate && dupCheck.existingSession) {
      const intents = this.generateAppIntents(dupCheck.existingSession.upiUri);
      return {
        session: dupCheck.existingSession,
        intents,
        isDuplicateReuse: true,
      };
    }

    const sessionId = 'ses_' + crypto.randomBytes(8).toString('hex');
    const txnRef = 'OUP' + Date.now().toString().slice(-8) + crypto.randomBytes(2).toString('hex').toUpperCase();
    const expiresAt = Date.now() + (db.merchant.paymentTimeoutSeconds * 1000);

    const upiUri = this.generateUpiUri({
      vpa: db.merchant.vpa,
      merchantName: db.merchant.name,
      amount: params.amount,
      transactionRef: txnRef,
      orderId: params.orderId,
      note: `Payment for Order ${params.orderId}`,
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
      orderId: params.orderId,
      merchantId: db.merchant.id,
      amount: params.amount,
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

    return {
      session: newSession,
      intents,
    };
  }

  /**
   * Mark session as settled / paid (Mock Payment Provider or Bank Webhook)
   */
  public static markAsPaid(sessionId: string, method: string = 'UPI'): PaymentSession | null {
    const session = db.getSession(sessionId);
    if (!session) return null;

    if (session.status === 'PAID') {
      return session;
    }

    const updated = db.updateSession(sessionId, {
      status: 'PAID',
      paidAt: Date.now(),
      queuePosition: 0,
    });

    if (updated) {
      QueueService.releaseSlot(sessionId);
      
      // Dispatch Webhook event
      db.webhookLogs.unshift({
        id: 'wh_' + crypto.randomBytes(6).toString('hex'),
        event: 'payment.success',
        payload: {
          sessionId: updated.id,
          orderId: updated.orderId,
          amount: updated.amount,
          currency: updated.currency,
          paidAt: updated.paidAt,
          method,
          customerPhone: updated.customerPhone,
        },
        status: 200,
        timestamp: Date.now(),
        signature: 'sha256_mock_sig_' + crypto.randomBytes(8).toString('hex'),
      });
    }

    return updated || null;
  }
}
