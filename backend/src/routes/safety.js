import { Router } from "express";
import crypto from "crypto";
import { SafetyIncident } from "../models/SafetyIncident.js";
import { Complaint } from "../models/Complaint.js";
import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { notify } from "../services/notify.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { isAdmin, isSeeker } from "../utils/roles.js";

const router = Router();

router.post(
  "/incidents",
  asyncHandler(async (req, res) => {
    if (!isSeeker(req.user.role) && !isAdmin(req.user.role)) throw httpError(403, "Workers only");
    const type = [
      "emergency",
      "share_location",
      "call_contact",
      "support",
      "report_customer",
      "pause_job",
      "other",
    ].includes(req.body.type)
      ? req.body.type
      : "emergency";
    const requestId = req.body.requestId || null;
    if (requestId) {
      const job = await Request.findById(requestId).lean();
      if (!job) throw httpError(404, "Job not found");
      const onJob =
        String(job.providerId) === req.userId ||
        (job.crewMemberIds || []).some((id) => String(id) === req.userId);
      if (!onJob && !isAdmin(req.user.role)) throw httpError(403, "You can only report safety on your active job");
    }
    const doc = await SafetyIncident.create({
      workerId: req.userId,
      requestId,
      type,
      description: String(req.body.description || "").slice(0, 800),
      lat: req.body.lat != null ? Number(req.body.lat) : req.user.lat,
      lng: req.body.lng != null ? Number(req.body.lng) : req.user.lng,
    });
    const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
    for (const a of admins) {
      await notify(a._id, {
        type: "alert",
        text: `Safety incident from ${req.user.name}: ${type.replace(/_/g, " ")}`,
        requestId,
      });
    }
    res.status(201).json({
      incident: {
        id: String(doc._id),
        type: doc.type,
        status: doc.status,
        createdAt: doc.createdAt,
      },
    });
  })
);

router.get(
  "/incidents",
  asyncHandler(async (req, res) => {
    const filter = isAdmin(req.user.role) ? {} : { workerId: req.userId };
    const rows = await SafetyIncident.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      incidents: rows.map((r) => ({
        id: String(r._id),
        type: r.type,
        description: isAdmin(req.user.role) || String(r.workerId) === req.userId ? r.description : "",
        status: r.status,
        requestId: r.requestId ? String(r.requestId) : null,
        createdAt: r.createdAt,
        lat: String(r.workerId) === req.userId || isAdmin(req.user.role) ? r.lat : null,
        lng: String(r.workerId) === req.userId || isAdmin(req.user.role) ? r.lng : null,
      })),
    });
  })
);

router.get(
  "/incidents/:id",
  asyncHandler(async (req, res) => {
    const doc = await SafetyIncident.findById(req.params.id).lean();
    if (!doc) throw httpError(404, "Incident not found");
    if (String(doc.workerId) !== req.userId && !isAdmin(req.user.role)) throw httpError(403, "Not allowed");
    res.json({
      incident: {
        id: String(doc._id),
        type: doc.type,
        description: doc.description,
        status: doc.status,
        requestId: doc.requestId ? String(doc.requestId) : null,
        lat: doc.lat,
        lng: doc.lng,
        createdAt: doc.createdAt,
      },
    });
  })
);

router.post(
  "/report",
  asyncHandler(async (req, res) => {
    const requestId = req.body.requestId;
    const subject = String(req.body.subject || req.body.reason || "Report").slice(0, 120);
    const body = String(req.body.body || req.body.description || "").slice(0, 800);
    if (!subject) throw httpError(400, "A reason is required");
    let againstId = req.body.againstId || null;
    if (requestId) {
      const job = await Request.findById(requestId).lean();
      if (!job) throw httpError(404, "Job not found");
      const isParty =
        String(job.customerId) === req.userId ||
        String(job.providerId) === req.userId ||
        (job.crewMemberIds || []).some((id) => String(id) === req.userId);
      if (!isParty && !isAdmin(req.user.role)) throw httpError(403, "You can only report on your own job");
      if (!againstId) {
        againstId = String(job.customerId) === req.userId ? job.providerId : job.customerId;
      }
    }
    const n = await Complaint.countDocuments();
    const doc = await Complaint.create({
      code: `CMP-${String(n + 1).padStart(4, "0")}-${crypto.randomBytes(2).toString("hex")}`,
      reporterId: req.userId,
      againstId,
      requestId: requestId || null,
      party: isSeeker(req.user.role) ? "worker" : req.user.role === "business" ? "business" : "customer",
      subject,
      body,
    });
    const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
    for (const a of admins) {
      await notify(a._id, { type: "alert", text: `New report: ${subject}` });
    }
    res.status(201).json({ ok: true, id: String(doc._id) });
  })
);

export default router;
