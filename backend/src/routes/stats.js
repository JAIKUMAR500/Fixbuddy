import { Router } from "express";
import { Request } from "../models/Request.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isCreator, isSeeker } from "../utils/roles.js";
import { BUSY_JOB_STATUSES, PAID_JOB_STATUSES } from "../utils/geo.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (isSeeker(req.user.role)) {
      const mine = { providerId: req.userId };
      const [open, accepted, scheduled, inProgress, completed] = await Promise.all([
        Request.countDocuments({
          status: { $in: ["open", "requested"] },
          declinedBy: { $ne: req.userId },
          $or: [{ "matches.providerId": req.userId }, { publicPost: true }, { providerId: req.userId }],
        }),
        Request.countDocuments({ ...mine, status: "accepted" }),
        Request.countDocuments({ ...mine, status: { $in: ["scheduled", "on_the_way"] } }),
        Request.countDocuments({ ...mine, status: { $in: ["arrived", "otp_verified", "in_progress"] } }),
        Request.countDocuments({ ...mine, status: { $in: ["completed", ...PAID_JOB_STATUSES] } }),
      ]);
      const paid = await Request.find({
        ...mine,
        paymentStatus: "collected",
      })
        .select("estimatedAmount workerQuote paymentCollectedAt finance")
        .lean();
      const netOf = (r) => {
        const net = Number(r.finance?.workerNetPaise);
        if (Number.isFinite(net) && net > 0) return Math.trunc(net / 100);
        return r.workerQuote || r.estimatedAmount || 0;
      };
      const earnings = paid.reduce((s, r) => s + netOf(r), 0);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const todayEarnings = paid
        .filter((r) => r.paymentCollectedAt && new Date(r.paymentCollectedAt) >= start)
        .reduce((s, r) => s + netOf(r), 0);
      return res.json({
        stats: {
          newRequests: open,
          accepted,
          upcoming: scheduled,
          inProgress,
          completed,
          earnings,
          todayEarnings,
          ratingAvg: req.user.provider?.ratingAvg || 0,
          ratingCount: req.user.provider?.ratingCount || 0,
          completedJobs: req.user.provider?.completedJobs || completed,
        },
      });
    }

    if (isCreator(req.user.role)) {
      const mine = { customerId: req.userId };
      const [posted, open, active, completed] = await Promise.all([
        Request.countDocuments(mine),
        Request.countDocuments({ ...mine, status: { $in: ["open", "requested", "matching"] } }),
        Request.countDocuments({ ...mine, status: { $in: BUSY_JOB_STATUSES } }),
        Request.countDocuments({ ...mine, status: { $in: ["completed", ...PAID_JOB_STATUSES] } }),
      ]);
      const done = await Request.find({ ...mine, status: { $in: ["completed", "reviewed"] } })
        .select("estimatedAmount")
        .lean();
      const spend = done.reduce((s, r) => s + (r.estimatedAmount || 0), 0);
      return res.json({
        stats: {
          posted,
          newRequests: open,
          inProgress: active,
          completed,
          spend,
          earnings: spend,
        },
      });
    }

    res.json({ stats: {} });
  })
);

export default router;
