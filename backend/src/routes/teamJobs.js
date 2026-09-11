import { Router } from "express";
import mongoose from "mongoose";
import { Team } from "../models/Team.js";
import { TeamJob } from "../models/TeamJob.js";
import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { isCreator, isSeeker } from "../utils/roles.js";
import { notify, notifyMany } from "../services/notify.js";

const router = Router();

function present(job) {
  return {
    id: String(job._id), requestId: String(job.requestId), teamId: String(job.teamId), ownerId: String(job.ownerId), status: job.status,
    assignments: (job.assignments || []).map((item) => ({ memberId: String(item.memberId), status: item.status, lat: item.lat, lng: item.lng, lastSeenAt: item.lastSeenAt })),
    timeline: job.timeline || [],
  };
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!isCreator(req.user.role)) throw httpError(403, "Only customers and businesses can request a team");
    const team = await Team.findOne({ _id: req.body.teamId });
    if (!team) throw httpError(404, "Team not found");
    const members = team.members.filter((member) => member.userId && member.status === "active");
    if (!members.length) throw httpError(400, "The team needs at least one active worker");
    const session = await mongoose.startSession();
    let request;
    let teamJob;
    try {
      await session.withTransaction(async () => {
        request = await Request.findOneAndUpdate({ _id: req.body.requestId, customerId: req.userId, status: { $in: ["matching", "open", "requested"] }, providerId: null }, { $set: { status: "requested" }, $push: { timeline: { status: "requested", note: "Team request created", at: new Date() } } }, { new: true, session });
        if (!request) throw httpError(409, "This request is no longer available for a team");
        [teamJob] = await TeamJob.create([{ requestId: request._id, teamId: team._id, ownerId: team.ownerId, status: "requested", assignments: members.map((member) => ({ memberId: member.userId, status: "assigned" })), timeline: [{ status: "requested", note: "Team job created", at: new Date() }] }], { session });
      });
    } finally {
      await session.endSession();
    }
    await notify(team.ownerId, { type: "request", text: "A customer requested your team for a job.", requestId: request._id });
    await notifyMany(members.map((member) => member.userId), { type: "request", text: "You were assigned to a team job.", requestId: request._id });
    res.status(201).json({ teamJob: present(teamJob) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const job = await TeamJob.findById(req.params.id).lean();
    if (!job) throw httpError(404, "Team job not found");
    const allowed = String(job.ownerId) === req.userId || job.assignments.some((item) => String(item.memberId) === req.userId) || req.user.role === "admin";
    if (!allowed) throw httpError(403, "You do not have access to this team job");
    res.json({ teamJob: present(job) });
  })
);

router.post(
  "/:id/assign",
  asyncHandler(async (req, res) => {
    const job = await TeamJob.findById(req.params.id);
    if (!job || String(job.ownerId) !== req.userId) throw httpError(403, "Team leader access required");
    const member = await User.findOne({ _id: req.body.memberId, role: "worker", status: "active" }).select("_id").lean();
    if (!member) throw httpError(404, "Active worker not found");
    if (!job.assignments.some((item) => String(item.memberId) === String(member._id))) job.assignments.push({ memberId: member._id, status: "assigned" });
    job.timeline.push({ status: "assigned", note: "Team leader assigned a worker", at: new Date() });
    await job.save();
    await notify(member._id, { type: "request", text: "You were assigned to a team job.", requestId: job.requestId });
    res.json({ teamJob: present(job) });
  })
);

router.patch(
  "/:id/location",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role)) throw httpError(403, "Workers only");
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw httpError(400, "Valid location is required");
    const job = await TeamJob.findOneAndUpdate({ _id: req.params.id, "assignments.memberId": req.userId, "assignments.status": { $in: ["assigned", "accepted", "arrived"] } }, { $set: { "assignments.$.lat": lat, "assignments.$.lng": lng, "assignments.$.lastSeenAt": new Date() } }, { new: true }).lean();
    if (!job) throw httpError(404, "Active team assignment not found");
    res.json({ teamJob: present(job) });
  })
);

export default router;
