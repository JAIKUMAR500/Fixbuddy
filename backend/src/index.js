import http from "node:http";
import { createApp } from "./app.js";
import { env, logStartupConfig } from "./config/env.js";
import { attachRealtime } from "./realtime/io.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { ensureProductionAccounts } from "./utils/ensureAdmin.js";
import { ensureCanonicalCategories } from "./utils/categories.js";
import { startCron } from "./jobs/cron.js";
import { User } from "./models/User.js";
import { Conversation } from "./models/Conversation.js";
import { Request } from "./models/Request.js";
import { WorkerLock } from "./models/WorkerLock.js";
import { LedgerEntry } from "./models/LedgerEntry.js";
import { Session } from "./models/Session.js";
import { Cancellation } from "./models/Cancellation.js";
import { PaymentOrder } from "./models/PaymentOrder.js";
import { WebhookEvent } from "./models/WebhookEvent.js";
import { Review } from "./models/Review.js";
import { rateLimitStoreKind, useRedisRateLimitStore } from "./middleware/rateLimit.js";
import { connectRedis } from "./config/redis.js";

const app = createApp();
const server = http.createServer(app);
attachRealtime(server);
let redisClient = null;

/** Shared sliding window so rate limits hold across clustered instances. */
async function connectRateLimitStore() {
  if (!env.redisUrl) return;
  try {
    const client = await connectRedis(env.redisUrl);
    if (!client) {
      console.error("REDIS_URL is set but invalid; rate limiting stays in-process");
      return;
    }
    client.on("error", (err) => console.error("Redis rate-limit client error:", err.message));
    client.on("ready", () => console.log("Redis connection ready"));
    useRedisRateLimitStore(client);
    redisClient = client;
    console.log("Rate limiting uses the shared Redis store");
  } catch (err) {
    console.error("Redis unavailable, rate limiting stays in-process:", err.message);
  }
}

connectDb()
  .then(async () => {
    await ensureProductionAccounts();
    await ensureCanonicalCategories();
    await connectRateLimitStore();
    server.listen(env.port, "0.0.0.0", () => {
      console.log(`Fixbuddy API on http://localhost:${env.port}`);
      console.log("MongoDB connected");
      logStartupConfig({ rateLimitStore: rateLimitStoreKind() === "redis" ? "redis" : "in-process" });
      startCron();
    });
    User.syncIndexes().catch((err) => console.error("User index sync:", err.message));
    Conversation.syncIndexes().catch((err) => console.error("Conversation index sync:", err.message));
    Request.syncIndexes().catch((err) =>
      console.error("Request index sync:", err.message, "(one_engaged_job_per_provider needs at most one engaged job per worker)"),
    );
    WorkerLock.syncIndexes().catch((err) => console.error("WorkerLock index sync:", err.message));
    LedgerEntry.syncIndexes().catch((err) => console.error("LedgerEntry index sync:", err.message));
    Session.syncIndexes().catch((err) => console.error("Session index sync:", err.message));
    Cancellation.syncIndexes().catch((err) => console.error("Cancellation index sync:", err.message));
    PaymentOrder.syncIndexes().catch((err) => console.error("PaymentOrder index sync:", err.message));
    // Unique {provider, eventId} is what makes replayed webhooks idempotent.
    WebhookEvent.syncIndexes().catch((err) => console.error("WebhookEvent index sync:", err.message));
    Review.syncIndexes().catch((err) => console.error("Review index sync:", err.message));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    console.error("Start MongoDB then retry.");
    process.exit(1);
  });

async function shutdown() {
  if (redisClient) {
    try {
      redisClient.disconnect();
    } catch {
      /* ignore */
    }
  }
  await disconnectDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
