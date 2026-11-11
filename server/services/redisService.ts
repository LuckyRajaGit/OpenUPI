/**
 * Emulated In-Memory Redis Engine
 * Provides atomic locks, key-value TTL storage, sliding-window rate limiting,
 * and webhook deduplication cache for self-hosted OpenUPI deployments.
 */

export interface RedisHealth {
  status: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
  mode: 'EMBEDDED_MEMORY_REDIS' | 'STANDALONE_REDIS';
  latencyMs: number;
  totalKeys: number;
  uptimeSeconds: number;
  memoryUsedKb: number;
}

class RedisStoreService {
  private kv = new Map<string, { value: string; expiresAt: number | null }>();
  private startTime = Date.now();
  private locks = new Set<string>();

  /**
   * Set key with optional TTL in seconds
   */
  public set(key: string, value: string, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.kv.set(key, { value, expiresAt });
  }

  /**
   * Get value, automatically cleaning expired keys
   */
  public get(key: string): string | null {
    const item = this.kv.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.kv.delete(key);
      return null;
    }
    return item.value;
  }

  /**
   * Atomic Delete
   */
  public del(key: string): boolean {
    return this.kv.delete(key);
  }

  /**
   * Atomic Acquire Lock (SET NX EX)
   */
  public acquireLock(lockName: string, ttlSeconds: number = 10): boolean {
    const lockKey = `lock:${lockName}`;
    const existing = this.get(lockKey);
    if (existing) {
      return false; // Already locked by another process/thread
    }
    this.set(lockKey, 'LOCKED', ttlSeconds);
    return true;
  }

  /**
   * Release Lock
   */
  public releaseLock(lockName: string): void {
    this.del(`lock:${lockName}`);
  }

  /**
   * Sliding window rate limiter
   * Returns { allowed: boolean, remaining: number, resetSeconds: number }
   */
  public checkRateLimit(
    identifier: string,
    action: string,
    maxRequests: number,
    windowSeconds: number
  ): { allowed: boolean; remaining: number; resetSeconds: number } {
    const key = `ratelimit:${action}:${identifier}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let history: number[] = [];
    const raw = this.get(key);
    if (raw) {
      try {
        history = JSON.parse(raw);
      } catch {
        history = [];
      }
    }

    // Filter timestamps within the current window
    history = history.filter((timestamp) => now - timestamp < windowMs);

    if (history.length >= maxRequests) {
      const oldest = history[0];
      const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, resetSeconds };
    }

    history.push(now);
    this.set(key, JSON.stringify(history), windowSeconds);

    return {
      allowed: true,
      remaining: maxRequests - history.length,
      resetSeconds: windowSeconds,
    };
  }

  /**
   * Check & store webhook event for replay attack prevention
   * Returns true if event is unique; false if it was already processed
   */
  public checkWebhookNonce(eventId: string, ttlSeconds: number = 86400): boolean {
    const nonceKey = `webhook_nonce:${eventId}`;
    if (this.get(nonceKey)) {
      return false; // Replay detected!
    }
    this.set(nonceKey, 'PROCESSED', ttlSeconds);
    return true;
  }

  /**
   * Telemetry health for developer dashboard
   */
  public getHealth(): RedisHealth {
    // Purge expired keys
    const now = Date.now();
    for (const [key, item] of this.kv.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.kv.delete(key);
      }
    }

    return {
      status: 'CONNECTED',
      mode: 'EMBEDDED_MEMORY_REDIS',
      latencyMs: 1,
      totalKeys: this.kv.size,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsedKb: Math.round(this.kv.size * 0.4 + 128),
    };
  }
}

export const redis = new RedisStoreService();
