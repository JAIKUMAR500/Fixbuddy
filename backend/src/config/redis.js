/**
 * Production Redis wiring. REDIS_URL is the only input — never hardcoded.
 * Supports redis:// (plain) and rediss:// (TLS). A missing or invalid URL
 * means "do not use Redis"; the caller keeps the in-process fallback.
 */

const CONNECT_TIMEOUT_MS = 5_000;
const PING_TIMEOUT_MS = 3_000;

export function redisConnectionOptions(raw = process.env.REDIS_URL) {
  const url = String(raw || "").trim();
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") return null;

  const tlsParam = parsed.searchParams.get("tls");
  const useTls = parsed.protocol === "rediss:" || tlsParam === "true" || tlsParam === "1";

  return {
    url,
    connectTimeout: CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > 20) return null;
      return Math.min(times * 200, 2_000);
    },
    ...(useTls ? { tls: { rejectUnauthorized: true } } : {}),
  };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);
}

/**
 * Connects and pings. Returns null when Redis is unset, invalid, or unreachable.
 * Never logs the URL — it can contain a password.
 */
export async function connectRedis(raw = process.env.REDIS_URL) {
  const options = redisConnectionOptions(raw);
  if (!options) return null;

  const { default: Redis } = await import("ioredis");
  const { url, ...clientOpts } = options;
  const client = new Redis(url, clientOpts);
  try {
    await withTimeout(client.ping(), PING_TIMEOUT_MS, "Redis ping timeout");
    return client;
  } catch (err) {
    client.disconnect();
    throw err;
  }
}

export async function pingRedisClient(client) {
  if (!client) return false;
  try {
    const reply = await withTimeout(client.ping(), PING_TIMEOUT_MS, "Redis ping timeout");
    return reply === "PONG" || reply === "OK" || reply === true;
  } catch {
    return false;
  }
}
