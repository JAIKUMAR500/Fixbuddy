import { env } from "./env.js";

const allowedOrigins = new Set(
  [
    "https://fixbuddy-ivory.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8443",
    "https://localhost",
    "http://localhost",
    "http://localhost:8081",
    "capacitor://localhost",
    "ionic://localhost",
    ...String(env.clientOrigin)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ].map((s) => s.replace(/\/$/, "")),
);

export function isLocalDevOrigin(origin) {
  if (env.isProduction) return false;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "10.0.2.2") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  const clean = String(origin).replace(/\/$/, "");
  return allowedOrigins.has(clean) || isLocalDevOrigin(origin);
}

export { allowedOrigins };
