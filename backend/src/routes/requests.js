import { Router } from "express";
import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { Review } from "../models/Review.js";
import { matchProviders } from "../services/match.js";
import { notify, notifyMany } from "../services/notify.js";
import { ensureConversation } from "../services/chat.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { providerCard, formatWhen, presentRequest } from "../utils/serialize.js";
import { isAdmin, isCreator, isSeeker } from "../utils/roles.js";

const router = Router();

async function nextCode() {
  const n = await Request.countDocuments();
  return `REQ-${String(n + 1).padStart(4, "0")}`;
}

function pushTimeline(doc, status, note) {
  doc.status = status;
  doc.timeline.push({ status, note, at: new Date() });
}

async function loadPeople(r) {
  const ids = [r.customerId, r.providerId].filter(Boolean);
  const users = await User.find({ _id: { $in: ids } })
    .select("name avatar phone city area role provider")
    .lean();
  const map = Object.fromEntries(users.map((u) => [String(u._id), u]));
  const creator = map[String(r.customerId)];
  return {
    customer: creator
      ? {
          id: String(r.customerId),
          name: creator.provider?.businessName || creator.name,
          avatar: creator.avatar,
          phone: creator.phone,
          role: creator.role,
        }
      : null,
    provider: map[String(r.providerId)] ? providerCard(map[String(r.providerId)]) : null,
  };
}

function canViewOpenJob(req, doc) {
  if (isAdmin(req.user.role)) return true;
  if (String(doc.customerId) === req.userId) return true;
  if (doc.providerId && String(doc.providerId) === req.userId) return true;
  if (isSeeker(req.user.role) && ["matching", "open", "requested"].includes(doc.status)) return true;
  return false;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role)) throw httpError(403, "Only customers and businesses can create jobs");
    const { description, category, address, area, city, timing, publicPost, tags, photos, lat, lng, landmark, voiceNote, estimatedAmount, budgetMin, budgetMax, scheduledAt, scheduledLabel } = req.body || {};
    if (!description || !category) throw httpError(400, "Description and category are required");
    const amount = Number(estimatedAmount || budgetMax || budgetMin || 0);
    const postedByRole = req.user.role === "admin" ? "admin" : req.user.role === "business" || req.user.role === "provider" ? "business" : "customer";
    const doc = await Request.create({
      code: await nextCode(),
      customerId: req.userId,
      postedByRole,
      description,
      category,
      address: address || req.user.address || "",
      area: area || req.user.area || "",
      city: city || req.user.city || "Coimbatore",
      landmark: landmark || "",
      lat: lat != null ? Number(lat) : req.user.lat,
      lng: lng != null ? Number(lng) : req.user.lng,
      photos: Array.isArray(photos) ? photos.slice(0, 12) : [],
      voiceNote: voiceNote || "",
      timing: timing || "asap",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      scheduledLabel: scheduledLabel || "",
      estimatedAmount: amount,
      budgetMin: Number(budgetMin || amount || 0),
      budgetMax: Number(budgetMax || amount || 0),
      tags: tags || [],
      publicPost: publicPost !== false,
      status: "matching",
      timeline: [{ status: "matching", note: "Job posted", at: new Date() }],
    });

    const scored = await matchProviders(doc);
    doc.matches = scored.map((s) => ({
      providerId: s.provider._id,
      score: s.score,
      reason: s.reason,
      distance: s.distance,
    }));
    pushTimeline(doc, "open", `${scored.length} workers matched`);
    await doc.save();

    await notifyMany(
      scored.map((s) => s.provider._id),
      {
        type: "request",
        text: `New job: ${category} in ${doc.area || doc.city}`,
        requestId: doc._id,
      }
    );

    res.status(201).json({
      request: presentRequest(doc, {
        matches: scored.map((s) => providerCard(s.provider, { score: s.score, reason: s.reason, distance: s.distance })),
      }),
    });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (isAdmin(req.user.role) && req.query.all === "true") {
      /* admin listing all */
    } else if (isCreator(req.user.role) && !isSeeker(req.user.role)) {
      filter.customerId = req.userId;
    } else if (isSeeker(req.user.role)) {
      const inbox = req.query.inbox === "true";
      if (inbox) {
        const cat = req.user.provider?.category;
        filter.$or = [
          { providerId: req.userId },
          {
            status: { $in: ["open", "requested"] },
            declinedBy: { $ne: req.userId },
            $or: cat
              ? [{ category: cat }, { "matches.providerId": req.userId }, { publicPost: true }]
              : [{ "matches.providerId": req.userId }, { publicPost: true }],
          },
        ];
      } else {
        filter.providerId = req.userId;
      }
    } else {
      filter.customerId = req.userId;
    }
    if (req.query.status) filter.status = req.query.status;
    const rows = await Request.find(filter).sort({ createdAt: -1 }).limit(80).lean();
    const people = await User.find({
      _id: { $in: rows.flatMap((r) => [r.customerId, r.providerId]).filter(Boolean) },
    })
      .select("name avatar phone city area role provider")
      .lean();
    const map = Object.fromEntries(people.map((u) => [String(u._id), u]));
    res.json({
      requests: rows.map((r) =>
        presentRequest(r, {
          customer: map[String(r.customerId)]
            ? {
                id: String(r.customerId),
                name: map[String(r.customerId)].provider?.businessName || map[String(r.customerId)].name,
                avatar: map[String(r.customerId)].avatar,
                phone: map[String(r.customerId)].phone,
                role: map[String(r.customerId)].role,
              }
            : null,
          provider: map[String(r.providerId)] ? providerCard(map[String(r.providerId)]) : null,
        })
      ),
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const doc = await Request.findById(req.params.id).lean();
    if (!doc) throw httpError(404, "Request not found");
    if (!canViewOpenJob(req, doc)) throw httpError(403, "You do not have access to this request");
    const extras = await loadPeople(doc);
    if (req.query.matches === "true") {
      const ids = (doc.matches || []).map((m) => m.providerId);
      const users = await User.find({ _id: { $in: ids } }).lean();
      const umap = Object.fromEntries(users.map((u) => [String(u._id), u]));
      extras.matches = (doc.matches || [])
        .map((m) => {
          const u = umap[String(m.providerId)];
          return u ? providerCard(u, { score: m.score, reason: m.reason, distance: m.distance }) : null;
        })
        .filter(Boolean);
    }
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/assign",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role)) throw httpError(403, "Job creators only");
    const doc = await Request.findById(req.params.id);
    if (!doc) throw httpError(404, "Request not found");
    if (String(doc.customerId) !== req.userId && !isAdmin(req.user.role)) throw httpError(403, "Not your job");
    const providerId = req.body.providerId;
    if (!providerId) throw httpError(400, "providerId is required");
    const worker = await User.findOne({ _id: providerId, role: "worker" }).lean();
    if (!worker) throw httpError(400, "You can only assign a worker");
    doc.providerId = providerId;
    pushTimeline(doc, "requested", "Creator requested this worker");
    await doc.save();
    await ensureConversation(doc);
    await notify(providerId, {
      type: "request",
      text: `${req.user.name} requested you for a job`,
      requestId: doc._id,
    });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/quote",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Only workers can send a quote");
    const doc = await Request.findById(req.params.id);
    if (!doc) throw httpError(404, "Request not found");
    if (!canViewOpenJob(req, doc)) throw httpError(403, "You do not have access to this request");
    const amount = Number(req.body.amount);
    if (!amount || amount < 1) throw httpError(400, "Enter a valid amount");
    doc.workerQuote = amount;
    doc.timeline.push({ status: doc.status, note: `Worker quoted ₹${amount}`, at: new Date() });
    await doc.save();
    await notify(doc.customerId, {
      type: "info",
      text: `${req.user.provider?.businessName || req.user.name} quoted ₹${amount}`,
      requestId: doc._id,
    });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/accept",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Only workers can take jobs");
    const doc = await Request.findById(req.params.id);
    if (!doc) throw httpError(404, "Request not found");
    if (doc.providerId && String(doc.providerId) !== req.userId) throw httpError(409, "Already assigned");
    const busy = await Request.findOne({
      providerId: req.userId,
      status: { $in: ["accepted", "scheduled", "in_progress"] },
      _id: { $ne: doc._id },
    }).select("_id").lean();
    if (busy) throw httpError(409, "Finish your current job before accepting another.");
    doc.providerId = req.userId;
    pushTimeline(doc, "accepted", "Worker accepted the job");
    await doc.save();
    await ensureConversation(doc);
    await notify(doc.customerId, {
      type: "success",
      text: `${req.user.provider?.businessName || req.user.name} accepted your job`,
      requestId: doc._id,
    });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/decline",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Only workers can decline jobs");
    const doc = await Request.findById(req.params.id);
    if (!doc) throw httpError(404, "Request not found");
    doc.declinedBy = [...new Set([...(doc.declinedBy || []).map(String), req.userId])];
    if (doc.providerId && String(doc.providerId) === req.userId) {
      doc.providerId = null;
      pushTimeline(doc, "open", "Worker declined; job reopened");
    }
    await doc.save();
    res.json({ request: presentRequest(doc) });
  })
);

router.post(
  "/:id/schedule",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    doc.scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : new Date();
    doc.scheduledLabel = req.body.scheduledLabel || formatWhen(doc.scheduledAt);
    pushTimeline(doc, "scheduled", `Scheduled for ${doc.scheduledLabel}`);
    await doc.save();
    await notify(doc.customerId, {
      type: "info",
      text: `Your job is scheduled for ${doc.scheduledLabel}`,
      requestId: doc._id,
    });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    pushTimeline(doc, "in_progress", "Work started");
    await doc.save();
    await notify(doc.customerId, { type: "info", text: "Work is now in progress", requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    pushTimeline(doc, "completed", "Work completed");
    await doc.save();
    await User.updateOne({ _id: req.userId }, { $inc: { "provider.completedJobs": 1 } });
    await notify(doc.customerId, {
      type: "success",
      text: "Your job is completed. Please leave a review.",
      requestId: doc._id,
    });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const doc = await Request.findById(req.params.id);
    if (!doc) throw httpError(404, "Request not found");
    const isOwner = String(doc.customerId) === req.userId || String(doc.providerId) === req.userId;
    if (!isOwner && !isAdmin(req.user.role)) throw httpError(403, "Not allowed");
    if (["completed", "reviewed"].includes(doc.status)) throw httpError(400, "Cannot cancel a finished job");
    pushTimeline(doc, "cancelled", req.body.reason || "Cancelled");
    await doc.save();
    const other = String(doc.customerId) === req.userId ? doc.providerId : doc.customerId;
    await notify(other, { type: "info", text: "A job was cancelled", requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/review",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role)) throw httpError(403, "Job creators only");
    const doc = await Request.findById(req.params.id);
    if (!doc || (String(doc.customerId) !== req.userId && !isAdmin(req.user.role))) throw httpError(403, "Not your job");
    if (!["completed", "reviewed"].includes(doc.status)) throw httpError(400, "Job is not completed yet");
    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) throw httpError(400, "Rating 1–5 is required");
    const existing = await Review.findOne({ requestId: doc._id });
    if (existing) throw httpError(409, "Already reviewed");
    await Review.create({
      requestId: doc._id,
      customerId: req.userId,
      providerId: doc.providerId,
      rating,
      comment: req.body.comment || "",
    });
    pushTimeline(doc, "reviewed", `Rated ${rating}/5`);
    await doc.save();
    const stats = await Review.aggregate([
      { $match: { providerId: doc.providerId } },
      { $group: { _id: "$providerId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    if (stats[0]) {
      await User.updateOne(
        { _id: doc.providerId },
        { $set: { "provider.ratingAvg": Math.round(stats[0].avg * 10) / 10, "provider.ratingCount": stats[0].count } }
      );
    }
    await notify(doc.providerId, { type: "review", text: `${req.user.name} left a ${rating}-star review`, requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

export default router;
