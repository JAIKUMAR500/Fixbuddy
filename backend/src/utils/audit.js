import { AuditLog } from "../models/AuditLog.js";

export async function logAudit(req, action, target = "", meta = {}) {
  try {
    await AuditLog.create({
      adminId: req.userId,
      adminName: req.user?.name || "Admin",
      action,
      target,
      ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
      meta,
    });
  } catch {
    /* audit must never break the request */
  }
}
