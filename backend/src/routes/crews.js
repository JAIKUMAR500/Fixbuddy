import { Router } from "express";
import { Crew } from "../models/Crew.js";
import { User } from "../models/User.js";
import { Request } from "../models/Request.js";
import { notify } from "../services/notify.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { presentCrew } from "../utils/serialize.js";
import { isCreator, isSeeker, isAdmin } from "../utils/roles.js";
import { getSettings } from "../models/PlatformSettings.js";
import { crewSplit } from "../utils/workerPower.js";
import { findWorkerLockedJob, LOCK_MESSAGE } from "../utils/jobLock.js";

const router = Router();

async function hydrate(crew) {
  const ids = (crew.members || []).map((m) => m.userId).filter(Boolean);
  const users = await User.find({ _id: { $in: ids } })
    .select("name avatar userCode provider")
    .lean();
  const map = Object.fromEntries(users.map((u) => [String(u._id), u]));
  return presentCrew(crew, map);
}

function memberOf(crew, userId) {
  return (crew.members || []).find((m) => String(m.userId) === String(userId));
}

function requireLeader(crew, userId) {
  const m = memberOf(crew, userId);
  if (!m || m.role !== "leader" || m.status !== "active") {
    const err = httpError(403, "Only the team leader can do this");
    throw err;
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.query.browse === "true") {
      if (!isCreator(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Job creators only");
      const q = { status: "active" };
      if (req.query.skill) q.skills = { $regex: String(req.query.skill), $options: "i" };
      const rows = await Crew.find(q).sort({ ratingAvg: -1, completedJobs: -1 }).limit(40).lean();
      const needed = Math.max(1, Number(req.query.workers || 1));
      const hydrated = [];
      for (const c of rows) {
        const active = (c.members || []).filter((m) => m.status === "active").length;
        if (active < needed) continue;
        hydrated.push(await hydrate(c));
      }
      return res.json({ crews: hydrated });
    }
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const rows = await Crew.find({ "members.userId": req.userId }).sort({ updatedAt: -1 }).lean();
    res.json({ crews: await Promise.all(rows.map(hydrate)) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role)) throw httpError(403, "Workers only");
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "Team name is required");
    const existing = await Crew.findOne({ leaderId: req.userId, status: "active" });
    if (existing) throw httpError(409, "You already lead a team. Open it from My Team.");
    const maxMembers = Math.min(20, Math.max(2, Number(req.body.maxMembers || 6)));
    const skills = Array.isArray(req.body.skills)
      ? req.body.skills.map(String)
      : String(req.body.skills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    const doc = await Crew.create({
      name,
      description: String(req.body.description || "").slice(0, 400),
      skills,
      serviceArea: String(req.body.serviceArea || req.user.city || ""),
      maxMembers,
      leaderId: req.userId,
      splitMode: ["equal", "role", "custom"].includes(req.body.splitMode) ? req.body.splitMode : "equal",
      members: [{ userId: req.userId, role: "leader", status: "active", sharePercent: 0 }],
    });
    res.status(201).json({ crew: await hydrate(doc) });
  })
);

router.get(
  "/search-workers",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ workers: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const rows = await User.find({
      role: "worker",
      status: "active",
      _id: { $ne: req.userId },
      $or: [{ name: rx }, { userCode: rx }, { email: rx }, { "provider.businessName": rx }],
    })
      .select("name avatar userCode provider.category provider.verified provider.ratingAvg provider.completedJobs")
      .limit(12)
      .lean();
    res.json({
      workers: rows.map((u) => ({
        id: String(u._id),
        name: u.provider?.businessName || u.name,
        userCode: u.userCode || "",
        avatar: u.avatar || "",
        category: u.provider?.category || "",
        verified: !!u.provider?.verified,
        ratingAvg: u.provider?.ratingAvg || 0,
        completedJobs: u.provider?.completedJobs || 0,
      })),
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const crew = await Crew.findById(req.params.id).lean();
    if (!crew) throw httpError(404, "Team not found");
    const mine = memberOf(crew, req.userId);
    if (!mine && !isCreator(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "You are not on this team");
    const payload = await hydrate(crew);
    if (!mine && !isAdmin(req.user.role)) {
      payload.members = payload.members.filter((m) => m.status === "active");
    }
    res.json({ crew: payload });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const crew = await Crew.findById(req.params.id);
    if (!crew) throw httpError(404, "Team not found");
    requireLeader(crew, req.userId);
    if (req.body.name) crew.name = String(req.body.name).trim();
    if (req.body.description != null) crew.description = String(req.body.description).slice(0, 400);
    if (req.body.serviceArea != null) crew.serviceArea = String(req.body.serviceArea);
    if (req.body.maxMembers) crew.maxMembers = Math.min(20, Math.max(2, Number(req.body.maxMembers)));
    if (["equal", "role", "custom"].includes(req.body.splitMode)) crew.splitMode = req.body.splitMode;
    if (Array.isArray(req.body.skills)) crew.skills = req.body.skills.map(String);
    if (crew.splitMode === "custom" && Array.isArray(req.body.shares)) {
      for (const s of req.body.shares) {
        const m = memberOf(crew, s.userId);
        if (m) m.sharePercent = Math.max(0, Math.min(100, Number(s.sharePercent || 0)));
      }
    }
    await crew.save();
    res.json({ crew: await hydrate(crew) });
  })
);

router.post(
  "/:id/invite",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role)) throw httpError(403, "Workers only");
    const crew = await Crew.findById(req.params.id);
    if (!crew) throw httpError(404, "Team not found");
    requireLeader(crew, req.userId);
    const workerId = req.body.userId || req.body.workerId;
    if (!workerId) throw httpError(400, "Pick a worker to invite");
    const worker = await User.findOne({ _id: workerId, role: "worker", status: "active" });
    if (!worker) throw httpError(404, "Worker not found");
    const active = crew.members.filter((m) => m.status === "active" || m.status === "pending");
    if (active.length >= crew.maxMembers) throw httpError(400, "This team is full");
    const existing = memberOf(crew, workerId);
    if (existing && existing.status === "active") throw httpError(409, "Already a member");
    if (existing && existing.status === "pending") throw httpError(409, "Invite already sent");
    crew.members.push({ userId: workerId, role: "member", status: "pending", sharePercent: 0 });
    await crew.save();
    await notify(workerId, {
      type: "info",
      text: `${crew.name} invited you to join their FixBuddy team`,
    });
    res.status(201).json({ crew: await hydrate(crew) });
  })
);

router.post(
  "/:id/invitations/:invitationId/accept",
  asyncHandler(async (req, res) => {
    const crew = await Crew.findById(req.params.id);
    if (!crew) throw httpError(404, "Team not found");
    const m = crew.members.id(req.params.invitationId) || memberOf(crew, req.userId);
    if (!m || String(m.userId) !== req.userId) throw httpError(403, "This invite is not for you");
    if (m.status === "active") return res.json({ crew: await hydrate(crew) });
    m.status = "active";
    await crew.save();
    await notify(crew.leaderId, { type: "success", text: `${req.user.name} joined ${crew.name}` });
    res.json({ crew: await hydrate(crew) });
  })
);

router.post(
  "/:id/invitations/:invitationId/reject",
  asyncHandler(async (req, res) => {
    const crew = await Crew.findById(req.params.id);
    if (!crew) throw httpError(404, "Team not found");
    const m = crew.members.id(req.params.invitationId) || memberOf(crew, req.userId);
    if (!m || String(m.userId) !== req.userId) throw httpError(403, "This invite is not for you");
    crew.members = crew.members.filter((x) => String(x._id) !== String(m._id));
    await crew.save();
    res.json({ crew: await hydrate(crew) });
  })
);

router.delete(
  "/:id/members/:memberId",
  asyncHandler(async (req, res) => {
    const crew = await Crew.findById(req.params.id);
    if (!crew) throw httpError(404, "Team not found");
    requireLeader(crew, req.userId);
    const m = crew.members.id(req.params.memberId) || memberOf(crew, req.params.memberId);
    if (!m) throw httpError(404, "Member not found");
    if (m.role === "leader") throw httpError(400, "The leader cannot be removed");
    crew.members = crew.members.filter((x) => String(x._id) !== String(m._id) && String(x.userId) !== String(m.userId));
    await crew.save();
    await notify(m.userId, { type: "info", text: `You were removed from ${crew.name}` });
    res.json({ crew: await hydrate(crew) });
  })
);

router.post(
  "/:id/jobs",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Job creators only");
    const crew = await Crew.findById(req.params.id);
    if (!crew || crew.status !== "active") throw httpError(404, "Team not found");
    const requestId = req.body.requestId;
    if (!requestId) throw httpError(400, "requestId is required");
    const doc = await Request.findById(requestId);
    if (!doc || (String(doc.customerId) !== req.userId && !isAdmin(req.user.role))) throw httpError(403, "Not your job");
    if (!["matching", "open", "requested"].includes(doc.status)) throw httpError(400, "This job is no longer open for a team");
    const needed = Math.max(doc.workersRequired || 1, Number(req.body.workersRequired || 1));
    const active = crew.members.filter((m) => m.status === "active");
    if (active.length < needed) throw httpError(400, "This team does not have enough available members");
    doc.crewId = crew._id;
    doc.workersRequired = needed;
    doc.invitedProviderIds = [...new Set([...(doc.invitedProviderIds || []).map(String), String(crew.leaderId)])];
    doc.timeline.push({ status: doc.status, note: `Team request sent to ${crew.name}`, at: new Date() });
    await doc.save();
    await notify(crew.leaderId, {
      type: "request",
      text: `Team job request: ${doc.category} · ${crew.name}`,
      requestId: doc._id,
    });
    res.json({ ok: true, requestId: String(doc._id) });
  })
);

router.post(
  "/:id/jobs/:jobId/accept",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const crew = await Crew.findById(req.params.id);
    if (!crew) throw httpError(404, "Team not found");
    requireLeader(crew, req.userId);
    const doc = await Request.findById(req.params.jobId);
    if (!doc || String(doc.crewId) !== String(crew._id)) throw httpError(404, "Team job not found");
    if (req.body.reject) {
      doc.crewId = null;
      doc.timeline.push({ status: doc.status, note: `${crew.name} declined the team job`, at: new Date() });
      await doc.save();
      await notify(doc.customerId, { type: "info", text: `${crew.name} cannot take this team job`, requestId: doc._id });
      return res.json({ ok: true, rejected: true });
    }
    if (!["matching", "open", "requested"].includes(doc.status) || doc.providerId) {
      throw httpError(409, "This job is no longer available");
    }
    const ids = (req.body.memberIds || []).map(String);
    const activeIds = crew.members.filter((m) => m.status === "active").map((m) => String(m.userId));
    const assigned = ids.filter((id) => activeIds.includes(id));
    if (!assigned.includes(String(crew.leaderId))) assigned.unshift(String(crew.leaderId));
    if (assigned.length < (doc.workersRequired || 1)) throw httpError(400, "Assign enough team members for this job");
    for (const id of assigned) {
      const busy = await findWorkerLockedJob(id);
      if (busy) throw httpError(409, LOCK_MESSAGE);
    }
    doc.providerId = crew.leaderId;
    doc.crewMemberIds = assigned;
    doc.status = "accepted";
    doc.timeline.push({ status: "accepted", note: `${crew.name} accepted. ${assigned.length} workers assigned.`, at: new Date() });
    await doc.save();
    await notify(doc.customerId, {
      type: "success",
      text: `${crew.name} accepted your team job`,
      requestId: doc._id,
    });
    for (const id of assigned) {
      if (String(id) === req.userId) continue;
      await notify(id, { type: "request", text: `You were assigned to ${crew.name} job ${doc.category}`, requestId: doc._id });
    }
    res.json({ ok: true });
  })
);

router.post(
  "/:id/jobs/:jobId/assign",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const crew = await Crew.findById(req.params.id);
    if (!crew) throw httpError(404, "Team not found");
    requireLeader(crew, req.userId);
    const doc = await Request.findById(req.params.jobId);
    if (!doc || String(doc.crewId) !== String(crew._id)) throw httpError(404, "Team job not found");
    const ids = (req.body.memberIds || []).map(String);
    const activeIds = crew.members.filter((m) => m.status === "active").map((m) => String(m.userId));
    doc.crewMemberIds = ids.filter((id) => activeIds.includes(id));
    if (!doc.crewMemberIds.map(String).includes(String(crew.leaderId))) doc.crewMemberIds.unshift(crew.leaderId);
    await doc.save();
    res.json({ ok: true, crewMemberIds: doc.crewMemberIds.map(String) });
  })
);

router.get(
  "/:id/earnings-preview",
  asyncHandler(async (req, res) => {
    const crew = await Crew.findById(req.params.id).lean();
    if (!crew) throw httpError(404, "Team not found");
    if (!memberOf(crew, req.userId) && !isAdmin(req.user.role) && !isCreator(req.user.role)) {
      throw httpError(403, "Not allowed");
    }
    const amount = Number(req.query.amount || 0);
    const settings = await getSettings();
    res.json({ split: crewSplit(amount, crew, settings.commissionPercent) });
  })
);

export default router;
