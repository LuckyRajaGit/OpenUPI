import { db } from '../store.ts';
import { PaymentSession, QueueStatus } from '../../src/types/index.ts';

export class QueueService {
  /**
   * Enqueue or directly activate a payment session based on concurrency limit
   */
  public static handleSessionQueue(session: PaymentSession): {
    status: 'ACTIVE' | 'QUEUED';
    queuePosition: number;
  } {
    this.cleanExpiredSessions();

    const maxConcurrency = db.merchant.maxConcurrentPayments;
    const currentActiveCount = db.activeProcessing.size;

    if (currentActiveCount < maxConcurrency && db.queue.length === 0) {
      // Slot available immediately!
      db.activeProcessing.add(session.id);
      session.status = 'ACTIVE';
      session.queuePosition = 0;
      db.updateSession(session.id, { status: 'ACTIVE', queuePosition: 0 });
      return { status: 'ACTIVE', queuePosition: 0 };
    } else {
      // Must wait in database queue
      db.queue.push(session.id);
      const position = db.queue.indexOf(session.id) + 1;
      session.status = 'QUEUED';
      session.queuePosition = position;
      db.updateSession(session.id, { status: 'QUEUED', queuePosition: position });
      return { status: 'QUEUED', queuePosition: position };
    }
  }

  /**
   * Release an active slot (when paid, cancelled, or expired) and advance queue
   */
  public static releaseSlot(sessionId: string) {
    db.activeProcessing.delete(sessionId);
    this.advanceQueue();
  }

  /**
   * Advance the next session waiting in the queue
   */
  public static advanceQueue() {
    this.cleanExpiredSessions();
    const maxConcurrency = db.merchant.maxConcurrentPayments;

    while (db.activeProcessing.size < maxConcurrency && db.queue.length > 0) {
      const nextSessionId = db.queue.shift();
      if (!nextSessionId) break;

      const session = db.getSession(nextSessionId);
      if (session && session.status === 'QUEUED') {
        db.activeProcessing.add(nextSessionId);
        session.status = 'ACTIVE';
        session.queuePosition = 0;
        session.expiresAt = Date.now() + (db.merchant.paymentTimeoutSeconds * 1000);
        db.updateSession(nextSessionId, {
          status: 'ACTIVE',
          queuePosition: 0,
          expiresAt: session.expiresAt,
        });
      }
    }

    // Recalculate positions for remaining queued sessions
    db.queue.forEach((sid, index) => {
      const sess = db.getSession(sid);
      if (sess) {
        sess.queuePosition = index + 1;
        db.updateSession(sid, { queuePosition: index + 1 });
      }
    });
  }

  /**
   * Check duplicate payment / Idempotency protection
   */
  public static checkDuplicate(
    orderId: string,
    idempotencyKey?: string
  ): { isDuplicate: boolean; existingSession?: PaymentSession; message?: string } {
    // 1. Check idempotency key if provided
    if (idempotencyKey && db.idempotencyKeys.has(idempotencyKey)) {
      const existingId = db.idempotencyKeys.get(idempotencyKey)!;
      const existing = db.getSession(existingId);
      if (existing) {
        return {
          isDuplicate: true,
          existingSession: existing,
          message: `Idempotent request: reusing existing payment session ${existing.id}`,
        };
      }
    }

    // 2. Check if an active or paid session already exists for this orderId
    for (const session of db.sessions.values()) {
      if (session.orderId === orderId) {
        if (session.status === 'PAID') {
          return {
            isDuplicate: true,
            existingSession: session,
            message: `Order ${orderId} has already been paid and settled. Duplicate transaction blocked.`,
          };
        }
        if (session.status === 'ACTIVE' || session.status === 'QUEUED') {
          // If not expired, reuse session
          if (Date.now() < session.expiresAt) {
            return {
              isDuplicate: true,
              existingSession: session,
              message: `Active payment session ${session.id} is already in progress for order ${orderId}.`,
            };
          }
        }
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Safe timeout cleaner: cleans up sessions that exceeded paymentTimeoutSeconds
   */
  public static cleanExpiredSessions(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, session] of db.sessions.entries()) {
      if ((session.status === 'ACTIVE' || session.status === 'QUEUED') && now > session.expiresAt) {
        session.status = 'EXPIRED';
        db.updateSession(id, { status: 'EXPIRED' });
        db.activeProcessing.delete(id);
        const qIndex = db.queue.indexOf(id);
        if (qIndex !== -1) {
          db.queue.splice(qIndex, 1);
        }
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get live queue telemetry
   */
  public static getQueueStatus(): QueueStatus {
    this.cleanExpiredSessions();
    const maxConcurrency = db.merchant.maxConcurrentPayments;
    const activeProcessing = db.activeProcessing.size;
    const availableSlots = Math.max(0, maxConcurrency - activeProcessing);

    return {
      totalInQueue: db.queue.length,
      activeProcessing,
      maxConcurrency,
      availableSlots,
      averageWaitTimeMs: db.queue.length * 15000,
    };
  }
}
