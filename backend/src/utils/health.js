import mongoose from "mongoose";
import { rateLimitRedisHealth } from "../middleware/rateLimit.js";

export function health(_req, res) {
  res.status(200).json({ ok: true, service: "fixbuddy-api" });
}

function redisLabel(snapshot) {
  if (!snapshot.configured) return "off";
  return snapshot.connected ? "up" : "down";
}

export async function ready(_req, res) {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return res.status(503).json({ ok: false, ready: false });
  }
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    const redis = await rateLimitRedisHealth();
    return res.status(200).json({
      ok: true,
      ready: true,
      // Status only. Never the URL, host, or password.
      redis: redisLabel(redis),
    });
  } catch {
    return res.status(503).json({ ok: false, ready: false });
  }
}
