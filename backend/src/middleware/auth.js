import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";
import { httpError } from "../utils/asyncHandler.js";
import { hasValidLicense } from "../utils/license.js";
import { clearAuthCookies, hashOpaque, readAccessToken, setAuthCookies } from "./authCookies.js";

/**
 * Dual auth: HttpOnly cookies (same-origin / first-party) plus Bearer JWT
 * for Capacitor and cross-origin clients that cannot rely on third-party cookies.
 * Never log tokens or refresh secrets.
 */

const userCache = new Map();
const USER_TTL_MS = 20_000;
const SEEN_TTL_MS = 60_000;

function hashTokenId(tokenId) {
  return crypto.createHash("sha256").update(String(tokenId)).digest("hex");
}

export function rememberAuthUser(user) {
  if (!user?._id) return;
  userCache.set(String(user._id), { user, at: Date.now() });
}

export function forgetAuthUser(id) {
  if (id) userCache.delete(String(id));
}

export async function resolveAccessToken(explicitToken, cookieHeader) {
  const token =
    String(explicitToken || "").trim() ||
    readAccessToken({ headers: { cookie: cookieHeader || "", authorization: "" } });
  if (!token) return null;
  const payload = jwt.verify(token, env.jwtSecret);
  if (!payload.jti) return null;
  const id = String(payload.sub);
  const session = await Session.findOne({
    userId: id,
    tokenHash: hashTokenId(payload.jti),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;
  const cached = userCache.get(id);
  let user = cached && Date.now() - cached.at < USER_TTL_MS ? cached.user : null;
  if (!user) {
    user = await User.findById(id).lean();
    if (user) rememberAuthUser(user);
  }
  if (!user) return null;
  return { user, session, payload };
}

export async function auth(req, res, next) {
  try {
    const token = readAccessToken(req);
    if (!token) throw httpError(401, "Sign in required");
    const resolved = await resolveAccessToken(token, req.headers.cookie);
    if (!resolved) throw httpError(401, "Session is no longer valid. Please sign in again.");
    const { user, session } = resolved;
    if (user.status === "suspended") throw httpError(403, "Account suspended");
    if (!hasValidLicense(user)) throw httpError(403, "Login license expired or not assigned. Ask Super Admin to grant access.");
    const id = String(user._id);
    req.user = user;
    req.userId = id;
    req.userCode = user.userCode || "";
    req.sessionId = String(session._id);
    const seenAt = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    if (Date.now() - seenAt > SEEN_TTL_MS) {
      User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
      user.lastSeenAt = new Date();
      rememberAuthUser(user);
    }
    next();
  } catch (err) {
    if (err.status) return next(err);
    if (err?.name === "TokenExpiredError") return next(httpError(401, "Session expired. Please sign in again."));
    if (err?.name === "JsonWebTokenError") return next(httpError(401, "Session is no longer valid. Please sign in again."));
    next(httpError(401, "Invalid or expired session"));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(httpError(403, "You do not have access to this action"));
    }
    next();
  };
}

export async function signToken(user, res) {
  const tokenId = crypto.randomBytes(32).toString("hex");
  const refreshRaw = crypto.randomBytes(32).toString("hex");
  const token = jwt.sign({ sub: String(user._id), role: user.role, uid: user.userCode || "" }, env.jwtSecret, {
    expiresIn: env.jwtAccessExpires,
    jwtid: tokenId,
  });
  await Session.create({
    userId: user._id,
    tokenHash: hashTokenId(tokenId),
    refreshHash: hashOpaque(refreshRaw),
    expiresAt: new Date(Date.now() + env.jwtRefreshMs),
  });
  if (res) {
    setAuthCookies(res, token, refreshRaw);
    res.locals.refreshToken = refreshRaw;
  }
  return token;
}

export function attachRefreshSecret(res, payload) {
  return {
    ...payload,
    refreshToken: res?.locals?.refreshToken || undefined,
    cookieAuth: true,
  };
}

export { clearAuthCookies };
