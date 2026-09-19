import crypto from "node:crypto";
import { env } from "../config/env.js";

export const ACCESS_COOKIE = "fb_access";
export const REFRESH_COOKIE = "fb_refresh";

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

export function readAccessToken(req) {
  const header = String(req.headers?.authorization || "");
  if (header.startsWith("Bearer ")) {
    const bearer = header.slice(7).trim();
    if (bearer) return bearer;
  }
  return parseCookies(req.headers?.cookie).fb_access || "";
}

export function readRefreshToken(req) {
  const fromCookie = parseCookies(req.headers?.cookie).fb_refresh || "";
  if (fromCookie) return fromCookie;
  return String(req.body?.refreshToken || "").trim();
}

export function hashOpaque(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function cookieBase() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "None" : "Lax",
    path: "/",
  };
}

function serializeCookie(name, value, extras) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (extras.httpOnly) parts.push("HttpOnly");
  if (extras.secure) parts.push("Secure");
  if (extras.sameSite) parts.push(`SameSite=${extras.sameSite}`);
  if (extras.path) parts.push(`Path=${extras.path}`);
  if (extras.maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(extras.maxAge))}`);
  return parts.join("; ");
}

function appendCookie(res, cookie) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  const list = Array.isArray(prev) ? prev : [prev];
  res.setHeader("Set-Cookie", [...list, cookie]);
}

export function setAuthCookies(res, accessToken, refreshToken) {
  if (!res) return;
  const base = cookieBase();
  appendCookie(
    res,
    serializeCookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: Math.floor(env.jwtAccessMs / 1000) }),
  );
  appendCookie(
    res,
    serializeCookie(REFRESH_COOKIE, refreshToken, { ...base, maxAge: Math.floor(env.jwtRefreshMs / 1000) }),
  );
}

export function clearAuthCookies(res) {
  if (!res) return;
  const base = cookieBase();
  appendCookie(res, serializeCookie(ACCESS_COOKIE, "", { ...base, maxAge: 0 }));
  appendCookie(res, serializeCookie(REFRESH_COOKIE, "", { ...base, maxAge: 0 }));
}
