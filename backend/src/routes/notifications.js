import { Router } from "express";
import { Notification } from "../models/Notification.js";
import { asyncHandler, timeAgo } from "../utils/asyncHandler.js";

const router = Router();

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
