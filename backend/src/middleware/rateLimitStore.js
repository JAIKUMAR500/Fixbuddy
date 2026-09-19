/**
 * Rate-limit backends.
 *
 * The in-process store is correct for a single instance. When REDIS_URL is set
 * the sliding window moves to Redis so the limit holds across every instance.
 * Redis failures fall back to the in-process store rather than locking users
 * out or silently disabling the limit.
 */

const MAX_KEYS = 20000;

export class MemoryRateLimitStore {
  constructor() {
    this.buckets = new Map();
  }

  get kind() {
    return "memory";
  }

  /** @returns {{ count: number, oldest: number }} hits inside the window. */
  hit(key, windowMs, now = Date.now()) {
    const kept = (this.buckets.get(key) || []).filter((t) => now - t < windowMs);
    kept.push(now);
    this.buckets.set(key, kept);
    if (this.buckets.size > MAX_KEYS) this.prune(windowMs, now);
    return { count: kept.length, oldest: kept[0] };
  }

  peek(key, windowMs, now = Date.now()) {
    const kept = (this.buckets.get(key) || []).filter((t) => now - t < windowMs);
    return { count: kept.length, oldest: kept[0] ?? now };
  }

  prune(windowMs, now = Date.now()) {
    for (const [key, hits] of this.buckets) {
      const kept = hits.filter((t) => now - t < windowMs);
      if (!kept.length) this.buckets.delete(key);
      else this.buckets.set(key, kept);
    }
  }

  reset() {
    this.buckets.clear();
  }
}

/**
 * Redis sorted-set sliding window. One round trip per request via pipeline:
 * drop expired members, add this hit, count, read the oldest, set the TTL.
 */
export class RedisRateLimitStore {
  constructor(client, { fallback = new MemoryRateLimitStore(), retryAfterMs = 15_000 } = {}) {
    this.client = client;
    this.fallback = fallback;
    this.healthy = true;
    this.degradedAt = 0;
    this.retryAfterMs = retryAfterMs;
  }

  get kind() {
    return "redis";
  }

  async hit(key, windowMs, now = Date.now()) {
    if (!this.healthy) {
      if (now - this.degradedAt < this.retryAfterMs) {
        return this.fallback.hit(key, windowMs, now);
      }
      this.healthy = true;
    }
    const redisKey = `rl:${key}`;
    try {
      const results = await this.client
        .multi()
        .zremrangebyscore(redisKey, 0, now - windowMs)
        .zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2, 10)}`)
        .zcard(redisKey)
        .zrange(redisKey, 0, 0, "WITHSCORES")
        .pexpire(redisKey, windowMs)
        .exec();
      const count = Number(readReply(results, 2));
      const range = readReply(results, 3);
      const oldest = Array.isArray(range) && range.length > 1 ? Number(range[1]) : now;
      if (!Number.isFinite(count) || count < 1) throw new Error("Unexpected Redis reply");
      return { count, oldest };
    } catch (err) {
      // Never fail a request because the shared store is unreachable.
      this.healthy = false;
      this.degradedAt = now;
      console.error("Rate limit store degraded to in-process:", err.message);
      return this.fallback.hit(key, windowMs, now);
    }
  }

  async ping() {
    if (!this.client?.ping) return false;
    try {
      const reply = await this.client.ping();
      const ok = reply === "PONG" || reply === "OK" || reply === true;
      this.healthy = ok;
      if (ok) this.degradedAt = 0;
      return ok;
    } catch {
      this.healthy = false;
      this.degradedAt = Date.now();
      return false;
    }
  }

  reset() {
    this.fallback.reset();
  }
}

/** ioredis returns [[err, value], ...]; node-redis returns bare values. */
function readReply(results, index) {
  const entry = results?.[index];
  if (Array.isArray(entry) && entry.length === 2 && (entry[0] === null || entry[0] instanceof Error)) {
    if (entry[0]) throw entry[0];
    return entry[1];
  }
  return entry;
}
