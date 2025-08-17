import type { Redis } from 'ioredis';
import { RedisLock } from './redis-lock.util';

// Minimal fake Redis implementing the commands we use
class FakeRedis implements Partial<Redis> {
  private store = new Map<string, { value: string; expiresAt: number }>();

  constructor(private now = () => Date.now()) {}

  public async set(key: string, value: string, px: 'PX', ttl: number, nx: 'NX'): Promise<'OK' | null> {
    const curr = this.store.get(key);
    if (curr && curr.expiresAt > this.now()) return null; // key exists and not expired
    const expiresAt = this.now() + ttl;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  public async get(key: string): Promise<string | null> {
    const v = this.store.get(key);
    if (!v) return null;
    if (v.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return v.value;
  }

  public async eval(script: string, numKeys: number, key: string, token: string): Promise<number> {
    const curr = await this.get(key);
    if (curr === token) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }
}

describe('RedisLock', () => {
  it('acquires and releases a lock', async () => {
    const redis = new FakeRedis() as unknown as Redis;
    const lock = new RedisLock(redis, { ttlMs: 1000 });

    const token = await lock.acquire('test');
    expect(typeof token).toBe('string');

    const released = await lock.release('test', token);
    expect(released).toBe(true);
  });

  it('prevents double acquisition without release', async () => {
    const redis = new FakeRedis() as unknown as Redis;
    const lock = new RedisLock(redis, { ttlMs: 1000, maxRetries: 2, retryDelayMs: 1 });

    const token1 = await lock.acquire('test');
    await expect(lock.tryAcquire('test')).resolves.toBeNull();

    // releasing with wrong token should fail
    const wrongRelease = await lock.release('test', 'wrong');
    expect(wrongRelease).toBe(false);

    // correct release succeeds
    const okRelease = await lock.release('test', token1);
    expect(okRelease).toBe(true);
  });

  it('expires lock and allows reacquisition after TTL', async () => {
    let current = Date.now();
    const redis = new FakeRedis(() => current) as unknown as Redis;
    const lock = new RedisLock(redis, { ttlMs: 100 });

    const token = await lock.acquire('exp');
    await expect(lock.tryAcquire('exp')).resolves.toBeNull();

    // advance time beyond TTL
    current += 200;

    const token2 = await lock.acquire('exp');
    expect(token2).not.toBe(token);
  });

  it('withLock runs critical section and releases', async () => {
    const redis = new FakeRedis() as unknown as Redis;
    const lock = new RedisLock(redis, { ttlMs: 1000 });

    const spy: number[] = [];
    const result = await lock.withLock('crit', async () => {
      spy.push(1);
      return 42;
    });

    expect(result).toBe(42);
    expect(spy).toHaveLength(1);

    // After withLock, should be able to acquire again
    const t = await lock.acquire('crit');
    expect(typeof t).toBe('string');
  });
});
