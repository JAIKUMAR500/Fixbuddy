import { Router } from "express";
import crypto from "crypto";
import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { Review } from "../models/Review.js";
import { Transaction } from "../models/Transaction.js";
import { Cancellation } from "../models/Cancellation.js";
import { getSettings } from "../models/PlatformSettings.js";
import { matchProviders } from "../services/match.js";
import { notify, notifyMany } from "../services/notify.js";
import { ensureConversation } from "../services/chat.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { providerCard, formatWhen, presentRequest } from "../utils/serialize.js";
import { isAdmin, isCreator, isSeeker } from "../utils/roles.js";
import { BUSY_JOB_STATUSES, LOCKED_JOB_STATUSES, km } from "../utils/geo.js";
import {
  DELAY_REASONS,
  LOCK_MESSAGE,
  NO_ACCESS_MESSAGE,
  UNAVAILABLE_MESSAGE,
  approxCoord,
  canCancelJob,
  delayLabel,
  findCurrentJob,
  findWorkerLockedJob,
  lockedJobFilter,
} from "../utils/jobLock.js";
import { normalizeLang, translateText } from "../utils/translate.js";

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
    .select("name avatar phone city area role provider lat lng lastSeenAt")
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

async function crewTracking(r) {
  const ids = r.crewMemberIds || [];
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids } })
    .select("name avatar provider")
    .lean();
  const status = r.status;
  const arrived = ["arrived", "otp_verified", "in_progress", "completed", "payment_collected", "customer_completed", "reviewed"].includes(status);
  const travelling = ["on_the_way", "arrived", "otp_verified", "in_progress", "completed", "payment_collected"].includes(status);
  return users.map((u) => ({
    id: String(u._id),
    name: u.provider?.businessName || u.name,
    avatar: u.avatar || "",
    state: arrived ? "arrived" : travelling ? "arriving" : "assigned",
  }));
}

function isInvited(doc, userId) {
  return (doc.invitedProviderIds || []).some((id) => String(id) === String(userId));
}

function canViewOpenJob(req, doc) {
  if (isAdmin(req.user.role)) return true;
  if (String(doc.customerId) === req.userId) return true;
  if (doc.providerId && String(doc.providerId) === req.userId) return true;
  if ((doc.crewMemberIds || []).some((id) => String(id) === req.userId)) return true;
  if (isInvited(doc, req.userId)) return true;
  if (isSeeker(req.user.role) && ["matching", "open", "requested"].includes(doc.status)) return true;
  return false;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role)) throw httpError(403, "Only customers and businesses can create jobs");
    const { description, category, address, area, city, timing, publicPost, tags, photos, lat, lng, landmark, voiceNote, estimatedAmount, budgetMin, budgetMax, scheduledAt, scheduledLabel, workersRequired, crewId, tower, flat, gateNote, visitorName, pinCode, preferredProviderId } = req.body || {};
    if (!description || !category) throw httpError(400, "Description and category are required");
    const amount = Number(estimatedAmount || budgetMax || budgetMin || 0);
    const postedByRole = req.user.role === "admin" ? "admin" : req.user.role === "business" || req.user.role === "provider" ? "business" : "customer";
    const customerLanguage = normalizeLang(req.body.customerLanguage || req.user.lang);
    const doc = await Request.create({
      code: await nextCode(),
      customerId: req.userId,
      postedByRole,
      description,
      category,
      address: address || req.user.address || "",
      area: area || req.user.area || "",
      city: city || req.user.city || "",
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
      workersRequired: Math.min(12, Math.max(1, Number(workersRequired || 1))),
      crewId: crewId || null,
      tower: String(tower || "").slice(0, 40),
      flat: String(flat || "").slice(0, 40),
      gateNote: String(gateNote || "").slice(0, 240),
      visitorName: String(visitorName || req.user.name || "").slice(0, 80),
      pinCode: String(pinCode || "").replace(/\D/g, "").slice(0, 6),
      preferredProviderId: preferredProviderId || null,
      customerLanguage,
      status: "matching",
      timeline: [{ status: "matching", note: "Job posted", at: new Date() }],
    });
    if (preferredProviderId) {
      doc.invitedProviderIds = [preferredProviderId];
    }

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
    if (preferredProviderId) {
      await notify(preferredProviderId, {
        type: "request",
        text: `${req.user.name} wants to book you again for ${category}. Accept to take this job.`,
        requestId: doc._id,
      });
    }

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
        const openJobs = {
          status: { $in: ["open", "requested", "matching"] },
          declinedBy: { $ne: req.userId },
          $and: [
            {
              $or: cat
                ? [{ category: cat }, { "matches.providerId": req.userId }, { invitedProviderIds: req.userId }, { publicPost: true }]
                : [{ "matches.providerId": req.userId }, { invitedProviderIds: req.userId }, { publicPost: true }],
            },
            {
              $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: req.userId }],
            },
          ],
        };
        filter.$or = [
          { providerId: req.userId, status: { $in: ["requested", ...BUSY_JOB_STATUSES, "completed"] } },
          { crewMemberIds: req.userId, status: { $in: ["requested", ...BUSY_JOB_STATUSES, "completed"] } },
          openJobs,
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
      .select("name avatar phone city area role provider lat lng lastSeenAt")
      .lean();
    const map = Object.fromEntries(people.map((u) => [String(u._id), u]));
    res.json({
      requests: rows.map((r) =>
        presentRequest(r, {
          revealOtp: String(r.customerId) === req.userId,
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
  "/active",
  asyncHandler(async (req, res) => {
    const filter = isSeeker(req.user.role)
      ? { providerId: req.userId, status: { $in: [...BUSY_JOB_STATUSES, "completed"] } }
      : { customerId: req.userId, status: { $in: [...BUSY_JOB_STATUSES, "matching", "open", "requested", "completed", "payment_collected", "customer_completed"] } };
    const doc = await Request.findOne(filter).sort({ updatedAt: -1 }).lean();
    if (!doc) return res.json({ request: null });
    const extras = await loadPeople(doc);
    extras.revealOtp = String(doc.customerId) === req.userId;
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.get(
  "/current-job",
  asyncHandler(async (req, res) => {
    const doc = await findCurrentJob(req.user, req.userId);
    if (!doc) return res.json({ request: null, locked: false });
    const extras = await loadPeople(doc);
    extras.revealOtp = String(doc.customerId) === req.userId;
    extras.hideGate = isCreator(req.user.role) && !isSeeker(req.user.role) ? false : String(doc.providerId) !== req.userId && !(doc.crewMemberIds || []).some((id) => String(id) === req.userId);
    res.json({ request: presentRequest(doc, extras), locked: true });
  })
);

router.get(
  "/price-band",
  asyncHandler(async (req, res) => {
    const city = String(req.query.city || req.user.city || "").trim();
    const category = String(req.query.category || "").trim();
    const pinCode = String(req.query.pinCode || "").replace(/\D/g, "").slice(0, 6);
    const match = {
      paymentStatus: "collected",
      ...(city ? { city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } : {}),
      ...(category ? { category: new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } : {}),
      ...(pinCode ? { pinCode } : {}),
    };
    const rows = await Request.find(match).select("estimatedAmount workerQuote").limit(80).lean();
    const amounts = rows.map((r) => Number(r.workerQuote || r.estimatedAmount || 0)).filter((n) => n > 0).sort((a, b) => a - b);
    if (amounts.length < 3) {
      return res.json({ city, category, pinCode, min: null, max: null, sample: amounts.length, text: "" });
    }
    const min = amounts[Math.floor(amounts.length * 0.2)];
    const max = amounts[Math.floor(amounts.length * 0.8)];
    res.json({
      city,
      category,
      pinCode,
      min,
      max,
      sample: amounts.length,
      text: `Usual price in your area: ₹${min}–₹${max}`,
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const doc = await Request.findById(req.params.id).lean();
    if (!doc) throw httpError(404, "Request not found");
    if (!canViewOpenJob(req, doc)) throw httpError(403, NO_ACCESS_MESSAGE);
    const extras = await loadPeople(doc);
    extras.revealOtp = String(doc.customerId) === req.userId;
    if (doc.crewId) extras.crewMembers = await crewTracking(doc);
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
    if (["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed", "payment_collected", "customer_completed", "reviewed"].includes(doc.status)) {
      throw httpError(409, "A worker already accepted this job.");
    }
    if (["cancelled", "declined"].includes(doc.status)) throw httpError(400, "This job is closed");
    const providerId = req.body.providerId;
    if (!providerId) throw httpError(400, "providerId is required");
    const worker = await User.findOne({ _id: providerId, role: "worker" }).lean();
    if (!worker) throw httpError(400, "You can only request a worker");
    const already = new Set((doc.invitedProviderIds || []).map(String));
    if (doc.providerId) already.add(String(doc.providerId));
    const firstTime = !already.has(String(providerId));
    already.add(String(providerId));
    doc.invitedProviderIds = [...already];
    doc.providerId = null;
    const workerName = worker.provider?.businessName || worker.name;
    if (firstTime) {
      if (doc.status === "requested") {
        doc.timeline.push({
          status: "requested",
          note: `Also requested ${workerName}. First worker to accept gets the job.`,
          at: new Date(),
        });
      } else {
        pushTimeline(doc, "requested", `Requested ${workerName}. First worker to accept gets the job.`);
      }
    }
    doc.status = "requested";
    await doc.save();
    if (firstTime) {
      await notify(providerId, {
        type: "request",
        text: `${req.user.name} requested you for a job. Accept first to take it.`,
        requestId: doc._id,
      });
    }
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
    if (!canViewOpenJob(req, doc)) throw httpError(403, NO_ACCESS_MESSAGE);
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
    if (req.user.provider?.available === false) throw httpError(409, "Go online before accepting a job.");
    const busy = await findWorkerLockedJob(req.userId);
    if (busy && String(busy._id) !== String(req.params.id)) throw httpError(409, LOCK_MESSAGE);
    const workerLanguage = normalizeLang(req.user.lang);
    const taken = await Request.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ["open", "requested", "matching"] },
        declinedBy: { $ne: req.userId },
        $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: req.userId }],
      },
      {
        $set: {
          providerId: req.userId,
          status: "accepted",
          acceptedAt: new Date(),
          workerLanguage,
        },
        $push: { timeline: { status: "accepted", note: "First worker to accept took this job", at: new Date() } },
      },
      { new: true }
    );
    if (!taken) {
      const existing = await Request.findById(req.params.id).select("status providerId").lean();
      if (!existing) throw httpError(404, "Request not found");
      if (existing.providerId && String(existing.providerId) !== req.userId) {
        throw httpError(409, "Another worker already accepted this job.");
      }
      throw httpError(409, UNAVAILABLE_MESSAGE);
    }
    const lockCount = await Request.countDocuments(lockedJobFilter(req.userId));
    if (lockCount > 1) {
      await Request.updateOne(
        { _id: taken._id, providerId: req.userId, status: "accepted" },
        {
          $set: { providerId: null, status: "open", acceptedAt: null },
          $push: { timeline: { status: "open", note: "Accept rolled back — worker already has an active job", at: new Date() } },
        }
      );
      throw httpError(409, LOCK_MESSAGE);
    }
    const customer = await User.findById(taken.customerId).select("lang").lean();
    const customerLanguage = normalizeLang(taken.customerLanguage || customer?.lang);
    taken.customerLanguage = customerLanguage;
    taken.translatedDescription = translateText(taken.description, customerLanguage, workerLanguage);
    await taken.save();
    await ensureConversation(taken);
    await notify(taken.customerId, {
      type: "success",
      text: `${req.user.provider?.businessName || req.user.name} accepted your job`,
      requestId: taken._id,
    });
    const others = (taken.invitedProviderIds || []).map(String).filter((id) => id !== req.userId);
    await notifyMany(others, {
      type: "info",
      text: "Another worker accepted this job first.",
      requestId: taken._id,
    });
    const extras = await loadPeople(taken.toObject());
    extras.revealOtp = false;
    res.json({ request: presentRequest(taken, extras) });
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
  "/:id/enroute",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    if (!["accepted", "scheduled"].includes(doc.status)) throw httpError(400, "Accept the job first, then start travel.");
    if (req.body.lat != null && req.body.lng != null) {
      doc.workerLat = Number(req.body.lat);
      doc.workerLng = Number(req.body.lng);
      doc.workerLocationAt = new Date();
    }
    pushTimeline(doc, "on_the_way", "Worker is on the way");
    await doc.save();
    await notify(doc.customerId, { type: "info", text: "Your worker is on the way. Track them live.", requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    extras.revealOtp = false;
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/arrive",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    if (!["on_the_way", "accepted", "scheduled"].includes(doc.status)) throw httpError(400, "Mark on the way before arriving.");
    doc.jobOtp = String(crypto.randomInt(1000, 10000));
    doc.jobOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    doc.jobOtpAttempts = 0;
    doc.jobOtpLockedUntil = null;
    doc.otpVerified = false;
    if (req.body.lat != null && req.body.lng != null) {
      doc.workerLat = Number(req.body.lat);
      doc.workerLng = Number(req.body.lng);
      doc.workerLocationAt = new Date();
    }
    pushTimeline(doc, "arrived", "Worker arrived. Share the 4-digit OTP to start work.");
    await doc.save();
    await notify(doc.customerId, { type: "success", text: "Worker arrived. Share your 4-digit OTP to start work.", requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    extras.revealOtp = false;
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/verify-otp",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    if (doc.status !== "arrived") throw httpError(400, "OTP is only used after the worker arrives.");
    const code = String(req.body.otp || "").replace(/\D/g, "");
    if (code.length !== 4) throw httpError(400, "Enter the 4-digit OTP from the customer.");
    if (!doc.jobOtp || doc.otpVerified) throw httpError(400, "OTP is no longer valid.");
    if (doc.jobOtpExpiresAt && doc.jobOtpExpiresAt.getTime() <= Date.now()) {
      doc.jobOtp = "";
      await doc.save();
      throw httpError(400, "OTP expired. Ask the customer to request a new arrival verification.");
    }
    if (doc.jobOtpLockedUntil && doc.jobOtpLockedUntil.getTime() > Date.now()) {
      throw httpError(429, "Too many incorrect OTP attempts. Try again later.");
    }
    if (code !== doc.jobOtp) {
      doc.jobOtpAttempts += 1;
      if (doc.jobOtpAttempts >= 5) doc.jobOtpLockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      await doc.save();
      throw httpError(400, "Invalid OTP. Ask the customer for the code on their screen.");
    }
    doc.otpVerified = true;
    doc.otpVerifiedAt = new Date();
    doc.jobOtp = "";
    doc.jobOtpExpiresAt = null;
    doc.jobOtpAttempts = 0;
    doc.jobOtpLockedUntil = null;
    pushTimeline(doc, "otp_verified", "Arrival verified with OTP");
    await doc.save();
    await notify(doc.customerId, { type: "success", text: "OTP verified. Work can start.", requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.patch(
  "/:id/location",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    if (!BUSY_JOB_STATUSES.includes(doc.status)) throw httpError(400, "Location updates are only during an active job.");
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw httpError(400, "lat and lng are required");
    doc.workerLat = lat;
    doc.workerLng = lng;
    doc.workerLocationAt = new Date();
    await doc.save();
    await User.updateOne({ _id: req.userId }, { $set: { lat, lng, lastSeenAt: new Date(), "provider.lat": lat, "provider.lng": lng } });
    const extras = await loadPeople(doc.toObject());
    extras.revealOtp = false;
    res.json({ request: presentRequest(doc, extras), distanceKm: km(doc.lat, doc.lng, lat, lng) });
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    if (!doc.otpVerified && doc.status !== "otp_verified") {
      throw httpError(403, "Verify the customer OTP after you arrive, then start work.");
    }
    doc.startedAt = new Date();
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
    if (doc.status !== "in_progress") throw httpError(400, "Start work before marking it complete.");
    doc.completedAt = new Date();
    pushTimeline(doc, "completed", "Work completed. Confirm payment collected.");
    await doc.save();
    await User.updateOne({ _id: req.userId }, { $inc: { "provider.completedJobs": 1 } });
    await notify(doc.customerId, {
      type: "success",
      text: "Work completed. Pay the worker, then they will confirm collection.",
      requestId: doc._id,
    });
    const extras = await loadPeople(doc.toObject());
    extras.revealOtp = String(doc.customerId) === req.userId;
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/collect-payment",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, "Not your job");
    if (doc.status !== "completed") throw httpError(400, "Complete the work before confirming payment.");
    if (doc.paymentStatus === "collected") throw httpError(409, "Payment is already confirmed.");
    const amount = Number(doc.workerQuote || doc.estimatedAmount || 0);
    doc.paymentStatus = "collected";
    doc.paymentCollectedAt = new Date();
    pushTimeline(doc, "payment_collected", `Payment of ₹${amount} collected`);
    await doc.save();
    const n = await Transaction.countDocuments();
    await Transaction.create({
      code: `TXN-${String(n + 1).padStart(4, "0")}`,
      requestId: doc._id,
      fromId: doc.customerId,
      toId: doc.providerId,
      amount,
      kind: "payment",
      status: "paid",
      note: "Job payment collected",
    });
    if (doc.crewId && (doc.crewMemberIds || []).length) {
      try {
        const { Crew } = await import("../models/Crew.js");
        const { getSettings } = await import("../models/PlatformSettings.js");
        const { crewSplit } = await import("../utils/workerPower.js");
        const crew = await Crew.findById(doc.crewId).lean();
        const settings = await getSettings();
        if (crew) {
          const split = crewSplit(amount, crew, settings.commissionPercent);
          await Crew.updateOne({ _id: crew._id }, { $inc: { completedJobs: 1 } });
          for (const s of split.shares) {
            await User.updateOne({ _id: s.userId }, { $inc: { walletBalance: s.amount } });
          }
          await notify(doc.customerId, {
            type: "success",
            text: `Team payment ₹${split.gross}. Platform fee ₹${split.fee}. Team earnings ₹${split.net}.`,
            requestId: doc._id,
          });
        } else {
          await User.updateOne({ _id: doc.providerId }, { $inc: { walletBalance: amount } });
        }
      } catch {
        await User.updateOne({ _id: doc.providerId }, { $inc: { walletBalance: amount } });
      }
    } else {
      await User.updateOne({ _id: doc.providerId }, { $inc: { walletBalance: amount } });
    }
    const helpers = (doc.crewMemberIds || []).map(String).filter((id) => id !== String(doc.providerId));
    if (helpers.length) {
      await notifyMany(helpers, {
        type: "info",
        text: "Crew job paid. You're available for helper jobs like loading, shifting, or cleaning assistance.",
        requestId: doc._id,
      });
    }
    try {
      const { getOrCreateTarget, todayEarned } = await import("../utils/workerPower.js");
      const target = await getOrCreateTarget(doc.providerId, 1500);
      const earned = await todayEarned(doc.providerId);
      if (earned >= target.amount && earned - amount < target.amount) {
        await notify(doc.providerId, {
          type: "success",
          text: `Daily target achieved! You earned ₹${earned} today (target ₹${target.amount}).`,
          requestId: doc._id,
        });
      }
    } catch {
      /* target notify is optional */
    }
    await notify(doc.customerId, {
      type: "success",
      text: `Payment of ₹${amount} confirmed. Mark the request complete and leave a review.`,
      requestId: doc._id,
    });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/customer-complete",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Job creators only");
    const doc = await Request.findById(req.params.id);
    if (!doc || (String(doc.customerId) !== req.userId && !isAdmin(req.user.role))) throw httpError(403, "Not your job");
    if (doc.paymentStatus !== "collected" && doc.status !== "payment_collected") {
      throw httpError(400, "Wait until the worker confirms payment.");
    }
    doc.customerCompleted = true;
    doc.customerCompletedAt = new Date();
    if (doc.status !== "reviewed") pushTimeline(doc, "customer_completed", "Customer confirmed the service is complete");
    await doc.save();
    await notify(doc.providerId, { type: "success", text: "Customer confirmed the job is complete.", requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    extras.revealOtp = true;
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
    if (["completed", "payment_collected", "customer_completed", "reviewed"].includes(doc.status)) throw httpError(400, "Cannot cancel a finished job");
    pushTimeline(doc, "cancelled", req.body.reason || "Cancelled");
    await doc.save();
    const other = String(doc.customerId) === req.userId ? doc.providerId : doc.customerId;
    await notify(other, { type: "info", text: "A job was cancelled", requestId: doc._id });
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras), compensation, eligible });
  })
);

router.post(
  "/:id/review",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role)) throw httpError(403, "Job creators only");
    const doc = await Request.findById(req.params.id);
    if (!doc || (String(doc.customerId) !== req.userId && !isAdmin(req.user.role))) throw httpError(403, "Not your job");
    if (!["completed", "payment_collected", "customer_completed", "reviewed"].includes(doc.status)) {
      throw httpError(400, "Job is not ready for a review yet");
    }
    if (doc.paymentStatus !== "collected" && doc.status !== "reviewed") {
      throw httpError(400, "Payment must be confirmed before a review");
    }
    const skip = req.body.skip === true;
    if (skip) {
      if (doc.status !== "reviewed") {
        doc.customerCompleted = true;
        pushTimeline(doc, "reviewed", "Customer skipped the review");
        await doc.save();
      }
      const extras = await loadPeople(doc.toObject());
      return res.json({ request: presentRequest(doc, extras) });
    }
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

router.post(
  "/:id/watch-link",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Job creators only");
    const doc = await Request.findById(req.params.id);
    if (!doc) throw httpError(404, "Request not found");
    if (String(doc.customerId) !== req.userId && !isAdmin(req.user.role)) throw httpError(403, NO_ACCESS_MESSAGE);
    if (!LOCKED_JOB_STATUSES.includes(doc.status) && !BUSY_JOB_STATUSES.includes(doc.status) && !["matching", "open", "requested"].includes(doc.status)) {
      throw httpError(400, "A watch link is only available while this job is open or active.");
    }
    const token = crypto.randomBytes(24).toString("hex");
    doc.watchToken = token;
    doc.watchTokenExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await doc.save();
    res.json({
      token,
      expiresAt: doc.watchTokenExpiresAt,
      path: `/watch/${token}`,
    });
  })
);

router.delete(
  "/:id/watch-link",
  asyncHandler(async (req, res) => {
    const doc = await Request.findById(req.params.id);
    if (!doc) throw httpError(404, "Request not found");
    if (String(doc.customerId) !== req.userId && !isAdmin(req.user.role)) throw httpError(403, NO_ACCESS_MESSAGE);
    doc.watchToken = "";
    doc.watchTokenExpiresAt = null;
    await doc.save();
    res.json({ ok: true });
  })
);

router.post(
  "/:id/work-photos",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, NO_ACCESS_MESSAGE);
    const stage = String(req.body.stage || "").toLowerCase();
    if (!["before", "during", "after"].includes(stage)) throw httpError(400, "Upload a before, during, or after photo.");
    const url = String(req.body.url || "").trim();
    if (!url) throw httpError(400, "Photo is required");
    doc.workPhotos = doc.workPhotos || { before: [], during: [], after: [] };
    const list = [...(doc.workPhotos[stage] || []), url].slice(-8);
    doc.workPhotos[stage] = list;
    doc.markModified("workPhotos");
    doc.timeline.push({ status: doc.status, note: `Work photo added (${stage})`, at: new Date() });
    await doc.save();
    const extras = await loadPeople(doc.toObject());
    res.json({ request: presentRequest(doc, extras) });
  })
);

router.post(
  "/:id/delay",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const doc = await Request.findById(req.params.id);
    if (!doc || String(doc.providerId) !== req.userId) throw httpError(403, NO_ACCESS_MESSAGE);
    if (!["accepted", "scheduled", "on_the_way"].includes(doc.status)) {
      throw httpError(400, "Delays can only be reported while travelling to the job.");
    }
    const reason = String(req.body.reason || "").toUpperCase();
    if (!DELAY_REASONS.includes(reason)) throw httpError(400, "Choose a valid delay reason.");
    doc.delayReason = reason;
    doc.delayNote = String(req.body.note || "").slice(0, 200);
    doc.timeline.push({
      status: doc.status,
      note: `Delay reported: ${delayLabel(reason)}`,
      at: new Date(),
    });
    await doc.save();
    const extras = await loadPeople(doc.toObject());
    const dist = km(doc.lat, doc.lng, doc.workerLat, doc.workerLng);
    const etaMin = dist != null ? Math.max(1, Math.round((dist / 18) * 60)) : null;
    await notify(doc.customerId, {
      type: "info",
      text: etaMin
        ? `Worker is delayed due to ${delayLabel(reason)}. Updated ETA: ${etaMin} minutes.`
        : `Worker is delayed due to ${delayLabel(reason)}.`,
      requestId: doc._id,
    });
    res.json({ request: presentRequest(doc, extras) });
  })
);

export default router;
