import { Router } from "express";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { asyncHandler, timeAgo } from "../utils/asyncHandler.js";
import { isProviderAccount } from "../utils/roles.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = req.query.providerId;
    const filter = q
      ? { providerId: q }
      : isProviderAccount(req.user.role)
        ? { providerId: req.userId }
        : { customerId: req.userId };
    const rows = await Review.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    const customers = await User.find({ _id: { $in: rows.map((r) => r.customerId) } })
      .select("name avatar")
      .lean();
    const map = Object.fromEntries(customers.map((u) => [String(u._id), u]));
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
    const dist = [0, 0, 0, 0, 0];
    rows.forEach((r) => {
      dist[r.rating - 1] += 1;
    });
    res.json({
      ratingAvg: Math.round(avg * 10) / 10,
      ratingCount: rows.length,
      distribution: dist,
      reviews: rows.map((r) => ({
        id: String(r._id),
        requestId: String(r.requestId),
        customer: map[String(r.customerId)]?.name || "Customer",
        avatar: map[String(r.customerId)]?.avatar || "",
        rating: r.rating,
        comment: r.comment,
        date: timeAgo(r.createdAt),
      })),
    });
  })
);

export default router;
