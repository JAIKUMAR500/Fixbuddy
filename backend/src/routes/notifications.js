import { Router } from "express";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { asyncHandler, timeAgo } from "../utils/asyncHandler.js";

const router = Router();

router.get("/preferences", asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select("notificationPreferences").lean();
  res.json({ preferences: user?.notificationPreferences || {} });
}));

router.patch("/preferences", asyncHandler(async (req, res) => {
  const allowed = ["inApp", "browser", "email", "jobUpdates", "paymentUpdates", "marketing"];
  const next = {};
  for (const key of allowed) if (req.body[key] !== undefined) next[`notificationPreferences.${key}`] = !!req.body[key];
  const user = await User.findByIdAndUpdate(req.userId, { $set: next }, { new: true }).select("notificationPreferences").lean();
  res.json({ preferences: user?.notificationPreferences || {} });
}));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      unread: rows.filter((n) => !n.read).length,
      notifications: rows.map((n) => ({
        id: String(n._id),
        type: n.type,
        text: n.text,
        read: n.read,
        requestId: n.requestId ? String(n.requestId) : null,
        time: timeAgo(n.createdAt),
      })),
    });
  })
);

router.post(
  "/read",
  asyncHandler(async (req, res) => {
    const { ids } = req.body || {};
    const filter = { userId: req.userId };
    if (Array.isArray(ids) && ids.length) filter._id = { $in: ids };
    await Notification.updateMany(filter, { $set: { read: true } });
    res.json({ ok: true });
  })
);

export default router;
