import { Router } from "express";
import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { WorkerDailyTarget } from "../models/WorkerDailyTarget.js";
import { WorkerPassport } from "../models/WorkerPassport.js";
import { SafetyIncident } from "../models/SafetyIncident.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { isSeeker } from "../utils/roles.js";
import { km, OPEN_JOB_STATUSES } from "../utils/geo.js";
import { notify, notifyMany } from "../services/notify.js";

const router = Router();

function workerOnly(req) {
  if (!isSeeker(req.user.role)) throw httpError(403, "Worker accounts only");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function amountFor(request) {
  return Number(request.workerQuote || request.estimatedAmount || 0);
}

function publicPassport(user, passport, stats) {
  return {
    worker: { id: String(user._id), name: user.name, avatar: user.avatar || "", city: user.city || "", role: user.role },
    passport: {
      bio: passport?.bio || "",
      experienceYears: passport?.experienceYears || 0,
      languages: passport?.languages || [],
      serviceAreas: passport?.serviceAreas || [],
      skills: (passport?.skills || []).map((skill) => ({ id: String(skill._id), name: skill.name, level: skill.level, verified: skill.verificationStatus === "verified" || !!skill.verified, verificationStatus: skill.verificationStatus || "unverified" })),
    },
      stats,
      badges: [
        ...(stats.totalJobs >= 100 ? ["100 Jobs Completed"] : []),
        ...(stats.rating >= 4.8 ? ["4.8+ Rated"] : []),
        ...(stats.verified ? ["Verified Professional"] : []),
      ],
      publicProfileUrl: `/workers/${String(user._id)}/public-profile`,
  };
}

async function workerStats(workerId) {
  const paid = await Request.find({ providerId: workerId, paymentStatus: "collected" })
    .select("workerQuote estimatedAmount paymentCollectedAt")
    .lean();
  const amount = paid.reduce((sum, item) => sum + amountFor(item), 0);
  const today = todayKey();
  const todayAmount = paid.filter((item) => item.paymentCollectedAt && new Date(item.paymentCollectedAt).toISOString().slice(0, 10) === today).reduce((sum, item) => sum + amountFor(item), 0);
  const completed = await Request.countDocuments({ providerId: workerId, status: { $in: ["completed", "payment_collected", "customer_completed", "reviewed"] } });
  return { totalJobs: completed, paidJobs: paid.length, totalEarnings: amount, todayEarnings: todayAmount };
}

router.get(
  "/daily-target",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const stats = await workerStats(req.userId);
    const target = await WorkerDailyTarget.findOneAndUpdate(
      { workerId: req.userId },
      { $setOnInsert: { workerId: req.userId, amount: 1500, targetDate: todayKey() } },
      { upsert: true, new: true }
    ).lean();
    if (target.targetDate !== todayKey()) {
      await WorkerDailyTarget.updateOne({ workerId: req.userId }, { $set: { amount: 1500, targetDate: todayKey() } });
      target.amount = 1500;
      target.targetDate = todayKey();
    }
    const remaining = Math.max(0, target.amount - stats.todayEarnings);
    res.json({ target: { amount: target.amount, date: todayKey(), earned: stats.todayEarnings, remaining, progress: target.amount ? Math.min(100, Math.round((stats.todayEarnings / target.amount) * 100)) : 0, achieved: stats.todayEarnings >= target.amount } });
  })
);

router.put(
  "/daily-target",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) throw httpError(400, "Enter a valid daily target");
    const target = await WorkerDailyTarget.findOneAndUpdate({ workerId: req.userId }, { $set: { amount, targetDate: todayKey() } }, { upsert: true, new: true }).lean();
    res.json({ target: { amount: target.amount, date: targetDate(target), earned: 0, remaining: target.amount, progress: 0, achieved: false } });
  })
);

function targetDate(target) {
  return target.targetDate || todayKey();
}

router.get(
  "/earnings/history",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const rows = await Request.find({ providerId: req.userId, paymentStatus: "collected" }).sort({ paymentCollectedAt: -1 }).limit(100).select("code category workerQuote estimatedAmount paymentCollectedAt status").lean();
    res.json({ earnings: rows.map((row) => ({ id: String(row._id), code: row.code, category: row.category, amount: amountFor(row), paidAt: row.paymentCollectedAt, status: row.status })) });
  })
);

async function nearby(req, res) {
  workerOnly(req);
  const lat = Number(req.query.lat ?? req.user.lat);
  const lng = Number(req.query.lng ?? req.user.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw httpError(400, "A valid worker location is required");
  const category = String(req.user.provider?.category || "").trim().toLowerCase();
  const rows = await Request.find({ status: { $in: OPEN_JOB_STATUSES }, providerId: null, declinedBy: { $ne: req.userId }, lat: { $ne: null }, lng: { $ne: null }, ...(category ? { $or: [{ category }, { tags: category }] } : {}) }).sort({ createdAt: -1 }).limit(80).lean();
  const jobs = rows.map((job) => {
    const distanceKm = km(lat, lng, job.lat, job.lng);
    const amount = amountFor(job);
    const urgent = String(job.timing || "").toLowerCase().includes("asap") ? 1 : 0;
    return { id: String(job._id), code: job.code, category: job.category, description: job.description, amount, distanceKm, etaMinutes: distanceKm == null ? null : Math.max(1, Math.round((distanceKm / 22) * 60)), area: job.area, city: job.city, timing: job.timing, urgent, score: (distanceKm == null ? 0 : Math.max(0, 100 - distanceKm * 10)) + amount / 20 + urgent * 12 };
  }).filter((job) => job.distanceKm == null || job.distanceKm <= 50).sort((a, b) => b.score - a.score).slice(0, 20);
  res.json({ jobs });
}

router.get("/nearby-jobs", asyncHandler(nearby));
router.get("/recommended-jobs", asyncHandler(nearby));

router.post(
  "/safety/incidents",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const type = ["emergency", "unsafe_location", "customer_report", "worker_report", "other"].includes(req.body.type) ? req.body.type : "emergency";
    const lat = req.body.lat == null ? null : Number(req.body.lat);
    const lng = req.body.lng == null ? null : Number(req.body.lng);
    const incident = await SafetyIncident.create({ workerId: req.userId, requestId: req.body.requestId || null, type, description: String(req.body.description || "").slice(0, 1000), lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null });
    const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
    await notifyMany(admins.map((admin) => admin._id), { type: "warning", text: `Worker safety incident reported: ${type}`, requestId: incident.requestId });
    res.status(201).json({ incident: { id: String(incident._id), status: incident.status, type: incident.type, createdAt: incident.createdAt } });
  })
);

router.get(
  "/safety/incidents/:id",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const incident = await SafetyIncident.findOne({ _id: req.params.id, workerId: req.userId }).lean();
    if (!incident) throw httpError(404, "Safety incident not found");
    res.json({ incident: { id: String(incident._id), type: incident.type, description: incident.description, status: incident.status, createdAt: incident.createdAt } });
  })
);

router.get(
  "/passport",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const passport = await WorkerPassport.findOne({ workerId: req.userId }).lean();
    res.json({ passport: publicPassport(req.user, passport, { ...(await workerStats(req.userId)), rating: req.user.provider?.ratingAvg || 0, verified: !!req.user.provider?.verified }) });
  })
);

router.put(
  "/passport",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const skills = Array.isArray(req.body.skills) ? req.body.skills.slice(0, 20).map((skill) => ({ name: String(skill.name || "").trim(), level: ["beginner", "experienced", "expert"].includes(skill.level) ? skill.level : "experienced" })).filter((skill) => skill.name) : [];
    const passport = await WorkerPassport.findOneAndUpdate({ workerId: req.userId }, { $set: { bio: String(req.body.bio || "").slice(0, 800), experienceYears: Math.max(0, Math.min(80, Number(req.body.experienceYears || 0))), languages: Array.isArray(req.body.languages) ? req.body.languages.slice(0, 8).map(String) : [], serviceAreas: Array.isArray(req.body.serviceAreas) ? req.body.serviceAreas.slice(0, 20).map(String) : [], skills } }, { upsert: true, new: true });
    res.json({ passport: publicPassport(req.user, passport, { ...(await workerStats(req.userId)), rating: req.user.provider?.ratingAvg || 0, verified: !!req.user.provider?.verified }) });
  })
);

router.post(
  "/skills/:id/verify",
  asyncHandler(async (req, res) => {
    workerOnly(req);
    const passport = await WorkerPassport.findOne({ workerId: req.userId });
    const skill = passport?.skills.id(req.params.id);
    if (!skill) throw httpError(404, "Skill not found");
    skill.verificationStatus = "pending";
    skill.verificationRequestedAt = new Date();
    await passport.save();
    res.json({ ok: true, status: skill.verificationStatus });
  })
);

router.get(
  "/:id/public-profile",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: "worker", status: "active" }).lean();
    if (!user) throw httpError(404, "Worker profile not found");
    const passport = await WorkerPassport.findOne({ workerId: user._id }).lean();
    res.json({ passport: publicPassport(user, passport, { ...(await workerStats(user._id)), rating: user.provider?.ratingAvg || 0, verified: !!user.provider?.verified }) });
  })
);

export const publicWorkerRoutes = Router();
publicWorkerRoutes.get(
  "/:id/public-profile",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: "worker", status: "active" }).lean();
    if (!user) throw httpError(404, "Worker profile not found");
    const passport = await WorkerPassport.findOne({ workerId: user._id }).lean();
    res.json({ passport: publicPassport(user, passport, { ...(await workerStats(user._id)), rating: user.provider?.ratingAvg || 0, verified: !!user.provider?.verified }) });
  })
);

export default router;
