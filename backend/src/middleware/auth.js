import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { httpError } from "../utils/asyncHandler.js";
import { hasValidLicense } from "../utils/license.js";

const userCache = new Map();
const USER_TTL_MS = 20_000;
const SEEN_TTL_MS = 60_000;

export function rememberAuthUser(user) {
  if (!user?._id) return;
  userCache.set(String(user._id), { user, at: Date.now() });
}

export function forgetAuthUser(id) {
  if (id) userCache.delete(String(id));
}

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw httpError(401, "Sign in required");
    const payload = jwt.verify(token, env.jwtSecret);
    const id = String(payload.sub);
    const cached = userCache.get(id);
    let user = cached && Date.now() - cached.at < USER_TTL_MS ? cached.user : null;
    if (!user) {
      user = await User.findById(id).lean();
      if (user) rememberAuthUser(user);
    }
    if (!user) throw httpError(401, "Account not found");
    if (user.status === "suspended") throw httpError(403, "Account suspended");
    if (!hasValidLicense(user)) throw httpError(403, "Login license expired or not assigned. Ask Super Admin to grant access.");
    req.user = user;
    req.userId = id;
    req.userCode = user.userCode || "";
    const seenAt = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    if (Date.now() - seenAt > SEEN_TTL_MS) {
      User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
      user.lastSeenAt = new Date();
      rememberAuthUser(user);
    }
    next();
  } catch (err) {
    if (err.status) return next(err);
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

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, uid: user.userCode || "" }, env.jwtSecret, {
    expiresIn: env.jwtExpires,
  });
}
