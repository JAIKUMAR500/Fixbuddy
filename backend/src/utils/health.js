import mongoose from "mongoose";

export function health(_req, res) {
  res.status(200).json({ ok: true, service: "fixbuddy-api" });
}

export async function ready(_req, res) {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return res.status(503).json({ ok: false, ready: false });
  }
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    return res.status(200).json({ ok: true, ready: true });
  } catch {
    return res.status(503).json({ ok: false, ready: false });
  }
}
