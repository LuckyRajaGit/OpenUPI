import crypto from 'crypto';
import { db } from '../store.ts';
import { RefundRecord, PaymentSession } from '../../src/types/index.ts';
import { WebhookService } from './webhookService.ts';
import { logger } from './loggerService.ts';
import { redis } from './redisService.ts';

export class RefundService {
  /**
   * Process a secure merchant-authorized refund
   */
  public static processRefund(params: {
    sessionId: string;
    merchantId: string;
    amount?: number;
    reason?: string;
    idempotencyKey?: string;
  }): {
    success: boolean;
    refund?: RefundRecord;
    session?: PaymentSession;
    error?: string;
    statusCode: number;
  } {
    const { sessionId, merchantId, reason, idempotencyKey } = params;

    // 1. Idempotency Lock
    if (idempotencyKey) {
      const lockAcquired = redis.acquireLock(`refund:${idempotencyKey}`, 10);
      if (!lockAcquired) {
        return {
          success: false,
          error: 'Concurrent refund operation in progress with this idempotency key. Please wait.',
          statusCode: 409,
        };
      }
    }

    try {
      const session = db.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Payment session not found', statusCode: 404 };
      }

      // 2. Multi-tenant Merchant Isolation / IDOR Protection
      if (session.merchantId !== merchantId) {
        logger.warn('REFUND', `Cross-merchant refund attempt blocked (IDOR). Session merchant: ${session.merchantId}, Request merchant: ${merchantId}`);
        return {
          success: false,
          error: 'Unauthorized: You do not have permission to refund transactions belonging to another merchant account.',
          statusCode: 403,
        };
      }

      // 3. Strict State Machine Validation
      if (session.status !== 'PAID' && session.status !== 'PARTIALLY_REFUNDED') {
        return {
          success: false,
          error: `Cannot refund session in state '${session.status}'. Only settled ('PAID') payments can be refunded.`,
          statusCode: 400,
        };
      }

      const currentRefunded = session.refundedAmount || 0;
      const refundAmount = params.amount !== undefined ? Number(params.amount) : session.amount - currentRefunded;

      if (isNaN(refundAmount) || refundAmount <= 0) {
        return { success: false, error: 'Valid positive refund amount is required', statusCode: 400 };
      }

      if (currentRefunded + refundAmount > session.amount) {
        return {
          success: false,
          error: `Refund amount of ₹${refundAmount} exceeds remaining refundable balance of ₹${(session.amount - currentRefunded).toFixed(2)}.`,
          statusCode: 400,
        };
      }

      // 4. Idempotency Result Cache
      if (idempotencyKey) {
        const cachedRefundId = redis.get(`refund_cache:${idempotencyKey}`);
        if (cachedRefundId && db.refunds.has(cachedRefundId)) {
          const cached = db.refunds.get(cachedRefundId)!;
          return { success: true, refund: cached, session, statusCode: 200 };
        }
      }

      // 5. Create and Record Refund
      const refundId = 'ref_' + crypto.randomBytes(8).toString('hex');
      const rrn = 'REF-RRN-' + Date.now().toString().slice(-8);

      const refundRecord: RefundRecord = {
        id: refundId,
        sessionId,
        merchantId,
        amount: refundAmount,
        currency: session.currency,
        reason: reason || 'Customer requested refund',
        status: 'PROCESSED',
        idempotencyKey,
        createdAt: Date.now(),
        rrn,
      };

      db.createRefund(refundRecord);

      if (idempotencyKey) {
        redis.set(`refund_cache:${idempotencyKey}`, refundId, 86400);
      }

      logger.info('REFUND', `Refund processed for session ${sessionId} (₹${refundAmount})`, {
        refundId,
        sessionId,
        merchantId,
        amount: refundAmount,
      });

      // 6. Dispatch Webhook
      WebhookService.dispatchEvent(merchantId, 'refund.processed', {
        refundId,
        sessionId,
        orderId: session.orderId,
        amount: refundAmount,
        currency: session.currency,
        status: 'PROCESSED',
        rrn,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        refund: refundRecord,
        session: db.getSession(sessionId),
        statusCode: 200,
      };
    } finally {
      if (idempotencyKey) {
        redis.releaseLock(`refund:${idempotencyKey}`);
      }
    }
  }
}
