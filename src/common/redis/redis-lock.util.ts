import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';

export interface RedisLockOptions {
  ttlMs?: number; // lock TTL in milliseconds
  retryDelayMs?: number; // delay between retries
  maxRetries?: number; // number of attempts before giving up
  keyPrefix?: string; // optional prefix for lock keys
}

export class RedisLock {
  private readonly logger = new Logger(RedisLock.name);
  private readonly redis: Redis;
  private readonly opts: Required<RedisLockOptions>;

  constructor(redis: Redis, options: RedisLockOptions = {}) {
    this.redis = redis;
    this.opts = {
      ttlMs: options.ttlMs ?? 10_000,
      retryDelayMs: options.retryDelayMs ?? 50,
      maxRetries: options.maxRetries ?? 50,
      keyPrefix: options.keyPrefix ?? 'lock:',
    };
  }

  private key(name: string): string {
    return `${this.opts.keyPrefix}${name}`;
  }

  /**
   * Try to acquire a lock using SET NX PX.
   * Returns the lock token if acquired, otherwise null.
   */
  public async tryAcquire(name: string, ttlMs?: number): Promise<string | null> {
    const token = randomUUID();
    const ttl = ttlMs ?? this.opts.ttlMs;
    const ok = await this.redis.set(this.key(name), token, 'PX', ttl, 'NX');
    return ok ? token : null;
  }

  /**
   * Acquire a lock with retries. Throws if it cannot acquire within maxRetries.
   * Returns the lock token to be used on release.
   */
  public async acquire(name: string, options?: Partial<RedisLockOptions>): Promise<string> {
    const ttl = options?.ttlMs ?? this.opts.ttlMs;
    const retryDelay = options?.retryDelayMs ?? this.opts.retryDelayMs;
    const maxRetries = options?.maxRetries ?? this.opts.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const token = await this.tryAcquire(name, ttl);
      if (token) return token;
      if (attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, retryDelay));
    }
    throw new Error(`Failed to acquire lock: ${name}`);
  }

  /**
   * Release a lock only if the token matches (Lua script for atomicity).
   * Returns true if the lock was released.
   */
  public async release(name: string, token: string): Promise<boolean> {
    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;
    const res = await this.redis.eval(script, 1, this.key(name), token);
    return res === 1 || res === '1';
  }

  /**
   * Convenience wrapper to run a function within a lock lifecycle.
   */
  public async withLock<T>(name: string, fn: () => Promise<T>, options?: Partial<RedisLockOptions>): Promise<T> {
    const token = await this.acquire(name, options);
    try {
      return await fn();
    } finally {
      try {
        await this.release(name, token);
      } catch (e) {
        this.logger.error(`Failed to release lock: ${String((e as Error).message)}`);
      }
    }
  }
}
