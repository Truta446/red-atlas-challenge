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

  it('acquire throws after maxRetries exhausted', async () => {
    // Fake redis that always reports key present (never expires)
    class BusyRedis extends FakeRedis {
      public override async set(): Promise<'OK' | null> {
        return null; // simulate NX not set
      }
    }
    const redis = new BusyRedis() as unknown as Redis;
    const lock = new RedisLock(redis, { ttlMs: 10, maxRetries: 0, retryDelayMs: 1 });
    await expect(lock.acquire('busy')).rejects.toThrow('Failed to acquire lock: busy');
  });

  it('withLock does not throw if release fails', async () => {
    const redis = new FakeRedis() as unknown as Redis;
    const lock = new RedisLock(redis, { ttlMs: 1000 });
    // Monkey-patch release to throw to exercise finally-catch path
    const realRelease = lock.release.bind(lock);
    (lock as any).release = jest.fn(async (...args: any[]) => {
      // call real once to delete, then throw on next call
      if ((lock as any)._thrown) throw new Error('release error');
      (lock as any)._thrown = true;
      return realRelease(...args);
    });

    const result = await lock.withLock('crit2', async () => 7);
    expect(result).toBe(7);
    // ensure our patched release was called
    expect((lock as any).release).toHaveBeenCalled();
  });

  it('acquire retries after delay then succeeds', async () => {
    class BusyOnce extends FakeRedis {
      private attempts = 0;
      public override async set(key: string, value: string, px: 'PX', ttl: number, nx: 'NX') {
        this.attempts += 1;
        if (this.attempts === 1) return null; // first attempt fails
        return super.set(key, value, px, ttl, nx);
      }
    }
    const redis = new BusyOnce() as unknown as Redis;
    const lock = new RedisLock(redis, { ttlMs: 50, retryDelayMs: 1, maxRetries: 2 });
    const token = await lock.acquire('retry');
    expect(typeof token).toBe('string');
  });
});
