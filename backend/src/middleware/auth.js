import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { httpError } from "../utils/asyncHandler.js";
import { hasValidLicense } from "../utils/license.js";

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw httpError(401, "Sign in required");
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).lean();
    if (!user) throw httpError(401, "Account not found");
    if (user.status === "suspended") throw httpError(403, "Account suspended");
    if (!hasValidLicense(user)) throw httpError(403, "Login license expired or not assigned. Ask Super Admin to grant access.");
    req.user = user;
    req.userId = String(user._id);
    req.userCode = user.userCode || "";
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
