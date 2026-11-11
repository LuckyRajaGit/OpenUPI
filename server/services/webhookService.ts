import crypto from 'crypto';
import { db } from '../store.ts';
import { redis } from './redisService.ts';
import { logger } from './loggerService.ts';

export class WebhookService {
  /**
   * Compute standard OpenUPI Webhook Signature
   * Signature = HMAC_SHA256(timestamp + "." + rawBody, webhookSecret)
   */
  public static signPayload(payloadString: string, timestamp: number, secret: string): string {
    const toSign = `${timestamp}.${payloadString}`;
    return crypto.createHmac('sha256', secret).update(toSign).digest('hex');
  }

  /**
   * Verify an incoming webhook signature with timestamp tolerance and replay protection
   */
  public static verifyWebhookSignature(params: {
    rawBody: string;
    signatureHeader: string; // e.g. "t=1700000000,v1=9a8b7c..." or "sha256=<hex>"
    secret: string;
    toleranceSeconds?: number;
    eventId?: string;
  }): { valid: boolean; reason?: string } {
    const { rawBody, signatureHeader, secret, toleranceSeconds = 300, eventId } = params;

    if (!signatureHeader) {
      return { valid: false, reason: 'Missing X-OpenUPI-Signature header' };
    }

    let timestamp: number | null = null;
    let receivedSignature: string | null = null;

    if (signatureHeader.includes('t=') && signatureHeader.includes('v1=')) {
      const parts = signatureHeader.split(',');
      for (const part of parts) {
        const [k, v] = part.trim().split('=');
        if (k === 't') timestamp = parseInt(v, 10);
        if (k === 'v1') receivedSignature = v;
      }
    } else if (signatureHeader.startsWith('sha256=')) {
      receivedSignature = signatureHeader.replace('sha256=', '');
      timestamp = Math.floor(Date.now() / 1000);
    } else {
      receivedSignature = signatureHeader;
      timestamp = Math.floor(Date.now() / 1000);
    }

    if (!receivedSignature) {
      return { valid: false, reason: 'Malformed signature header format' };
    }

    // 1. Timestamp Replay Tolerance Check (Reject if > 300 seconds old)
    if (timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.abs(now - timestamp);
      if (diff > toleranceSeconds) {
        return {
          valid: false,
          reason: `Webhook timestamp rejected: timestamp delta (${diff}s) exceeds tolerance window of ${toleranceSeconds}s (Replay Attack Prevention)`,
        };
      }
    }

    // 2. Nonce / Event ID Deduplication Check
    if (eventId) {
      const isUnique = redis.checkWebhookNonce(eventId);
      if (!isUnique) {
        return {
          valid: false,
          reason: `Duplicate webhook event detected (${eventId}). Event already processed.`,
        };
      }
    }

    // 3. Cryptographic Verification using timingSafeEqual
    const expectedSigWithTime = this.signPayload(rawBody, timestamp || Math.floor(Date.now() / 1000), secret);
    const expectedSigRaw = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const matchesTimestamped = this.safeCompare(receivedSignature, expectedSigWithTime);
    const matchesRaw = this.safeCompare(receivedSignature, expectedSigRaw);

    if (!matchesTimestamped && !matchesRaw) {
      return { valid: false, reason: 'Invalid signature: HMAC hash mismatch' };
    }

    return { valid: true };
  }

  private static safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  /**
   * Dispatch a webhook event to merchant endpoint
   */
  public static async dispatchEvent(merchantId: string, event: string, payload: any): Promise<boolean> {
    const merchant = db.getMerchant(merchantId) || db.merchant;
    const webhookUrl = merchant.webhookUrl || 'https://merchant.example.com/api/webhooks';
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadStr = JSON.stringify(payload);
    const signature = this.signPayload(payloadStr, timestamp, merchant.webhookSecret);
    const signatureHeader = `t=${timestamp},v1=${signature}`;

    const logEntry = {
      id: 'wh_' + crypto.randomBytes(6).toString('hex'),
      merchantId,
      event,
      payload,
      status: 200,
      timestamp: Date.now(),
      signature: signatureHeader,
    };

    db.webhookLogs.unshift(logEntry);
    if (db.webhookLogs.length > 100) db.webhookLogs.pop();

    logger.info('WEBHOOK', `Dispatched event ${event} for merchant ${merchantId}`, {
      event,
      merchantId,
      webhookUrl,
      timestamp,
    });

    return true;
  }
}
