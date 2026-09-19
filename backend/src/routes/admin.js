import bcrypt from "bcryptjs";
import { Router } from "express";
import { User } from "../models/User.js";
import { Request } from "../models/Request.js";
import { Review } from "../models/Review.js";
import { Notification } from "../models/Notification.js";
import { Category } from "../models/Category.js";
import { Complaint } from "../models/Complaint.js";
import { AuditLog } from "../models/AuditLog.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { getSettings, clearSettingsCache } from "../models/PlatformSettings.js";
import { MailJob } from "../models/MailJob.js";
import { sendMail, sendPendingMail } from "../services/mail.js";
import { requireRole } from "../middleware/auth.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { publicUser, presentRequest } from "../utils/serialize.js";
import { logAudit } from "../utils/audit.js";
import { notifyMany } from "../services/notify.js";
import { LEDGER_TYPES, SIMULATION_LABEL } from "../services/payments/config.js";
import { paiseToRupees } from "../services/payments/money.js";
import { buildLicense, licenseView, createUserWithCode } from "../utils/license.js";
import { WorkerPassport } from "../models/WorkerPassport.js";
import { BUSY_JOB_STATUSES, PAID_JOB_STATUSES } from "../utils/geo.js";
import { healPendingSkillsIntoPassport, loadPassport, syncUserSkillFromPassport } from "../utils/workerPower.js";
import { paramObjectId } from "../middleware/validate.js";
import { rateLimit, AUTH_LIMITS, clientKey } from "../middleware/rateLimit.js";

const adminMutateLimit = rateLimit({
  windowMs: AUTH_LIMITS.adminMutate.windowMs,
  max: AUTH_LIMITS.adminMutate.max,
  key: (req) => `admin-mutate:${req.userId || clientKey(req)}`,
  message: "Too many admin changes. Try again in a few minutes.",
});

const router = Router();
router.use(requireRole("admin"));
router.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  return adminMutateLimit(req, res, next);
});
router.param("id", paramObjectId("id"));
router.param("workerId", paramObjectId("workerId"));
router.param("skillId", paramObjectId("skillId"));

router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const twoWeeks = new Date(Date.now() - 14 * 86400000);
    const [
      users,
      workers,
      businesses,
      customers,
      requests,
      reviews,
      pendingVerification,
      activeJobs,
      completedJobs,
      revenueAgg,
      weekCustomers,
      prevWeekCustomers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "worker" }),
      User.countDocuments({ role: { $in: ["business", "provider"] } }),
      User.countDocuments({ role: "customer" }),
      Request.countDocuments(),
      Review.countDocuments(),
      User.countDocuments({ role: { $in: ["worker", "business", "provider"] }, "provider.verified": false }),
      Request.countDocuments({ status: { $in: BUSY_JOB_STATUSES } }),
      Request.countDocuments({ status: { $in: ["completed", ...PAID_JOB_STATUSES] } }),
      LedgerEntry.aggregate([
        { $match: { type: LEDGER_TYPES.COMMISSION, status: "simulated" } },
        { $group: { _id: null, total: { $sum: "$amountPaise" } } },
      ]),
      User.countDocuments({ role: "customer", createdAt: { $gte: weekAgo } }),
      User.countDocuments({ role: "customer", createdAt: { $gte: twoWeeks, $lt: weekAgo } }),
    ]);
    const byStatus = await Request.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
    const recent = await AuditLog.find().sort({ createdAt: -1 }).limit(8).lean();
    const growth =
      prevWeekCustomers === 0 ? (weekCustomers ? 100 : 0) : Math.round(((weekCustomers - prevWeekCustomers) / prevWeekCustomers) * 100);
    res.json({
      users,
      workers,
      businesses,
      providers: workers + businesses,
      customers,
      requests,
      reviews,
      pendingVerification,
      activeJobs,
      completedJobs,
      revenue: paiseToRupees(revenueAgg[0]?.total || 0),
      financialMode: "development",
      financialLabel: SIMULATION_LABEL,
      customerGrowth: growth,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      recentActivity: recent.map((a) => ({
        id: String(a._id),
        text: `${a.adminName} ${a.action}${a.target ? ` · ${a.target}` : ""}`,
        at: a.createdAt,
      })),
    });
  })
);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.role === "customer") filter.role = "customer";
    if (req.query.role === "worker") filter.role = "worker";
    if (req.query.role === "business") filter.role = { $in: ["business", "provider"] };
    if (req.query.role === "admin") filter.role = "admin";
    if (req.query.pending === "true") {
      filter.role = { $in: ["worker", "business", "provider"] };
      filter["provider.verified"] = false;
    }
    if (req.query.q) {
      const q = new RegExp(String(req.query.q), "i");
      filter.$or = [{ name: q }, { email: q }, { phone: q }, { city: q }, { userCode: q }, { "provider.businessName": q }];
    }
    const rows = await User.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const ids = rows.map((u) => u._id);
    const [posted, completed] = await Promise.all([
      Request.aggregate([{ $match: { customerId: { $in: ids } } }, { $group: { _id: "$customerId", n: { $sum: 1 } } }]),
      Request.aggregate([
        { $match: { customerId: { $in: ids }, status: { $in: ["completed", ...PAID_JOB_STATUSES] } } },
        { $group: { _id: "$customerId", n: { $sum: 1 } } },
      ]),
    ]);
    const postedMap = Object.fromEntries(posted.map((x) => [String(x._id), x.n]));
    const doneMap = Object.fromEntries(completed.map((x) => [String(x._id), x.n]));
    res.json({
      users: rows.map((u) => ({
        ...publicUser(u),
        requestCount: postedMap[String(u._id)] || 0,
        completedCount: doneMap[String(u._id)] || 0,
      })),
    });
  })
);

router.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).lean();
    if (!user) throw httpError(404, "User not found");
    const requests = await Request.find({
      $or: [{ customerId: user._id }, { providerId: user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();
    const reviews = await Review.find({
      $or: [{ customerId: user._id }, { providerId: user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({
      user: publicUser(user),
      requests: requests.map((r) => presentRequest(r)),
      reviews,
    });
  })
);

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const { name, email, phone, password, role } = req.body || {};
    if (!name || !email || !password) throw httpError(400, "Name, email and password are required");
    const nextRole = ["customer", "worker", "business", "admin"].includes(role) ? role : "customer";
    const exists = await User.findOne({ email: String(email).toLowerCase(), role: nextRole }).lean();
    if (exists) throw httpError(409, "Email already in use for this role");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUserWithCode({
      name,
      email: String(email).toLowerCase(),
      phone: phone || "",
      passwordHash,
      role: nextRole,
      license: buildLicense({ days: Number(req.body.days || 30), plan: req.body.plan || "standard", grantedBy: req.userId }),
      provider: ["worker", "business"].includes(nextRole) ? { businessName: name, onboarded: false } : undefined,
    });
    await logAudit(req, "Created user", `${name} (${nextRole})`);
    res.status(201).json({ user: publicUser(user.toObject()) });
  })
);

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const set = {};
    if (req.body.status) {
      if (!["active", "suspended"].includes(req.body.status)) throw httpError(400, "Invalid status");
      if (req.body.status === "suspended") {
        const reason = String(req.body.reason || "").trim();
        if (!reason) throw httpError(400, "A reason is required to suspend an account");
        set.status = "suspended";
      } else {
        set.status = "active";
      }
    }
    if (req.body.verified != null) set["provider.verified"] = !!req.body.verified;
    if (req.body.skillName && req.body.skillVerified != null) {
      const userDoc = await User.findById(req.params.id);
      if (!userDoc) throw httpError(404, "User not found");
      const skill = (userDoc.provider?.skills || []).find(
        (s) => String(s.name).toLowerCase() === String(req.body.skillName).toLowerCase() || String(s._id) === String(req.body.skillName)
      );
      if (skill) {
        skill.verified = !!req.body.skillVerified;
        skill.pending = false;
        await userDoc.save();
        await logAudit(req, req.body.skillVerified ? "Verified skill" : "Cleared skill verification", `${userDoc.email} · ${skill.name}`);
        return res.json({ user: publicUser(userDoc.toObject()) });
      }
    }
    if (req.body.role) set.role = req.body.role;
    if (req.body.name) set.name = req.body.name;
    if (req.body.city) set.city = req.body.city;
    const user = await User.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!user) throw httpError(404, "User not found");
    const reason = String(req.body.reason || "").trim();
    await logAudit(
      req,
      req.body.verified ? "Verified account" : req.body.status ? `Set status ${req.body.status}` : "Updated user",
      user.email,
      { reason, userId: String(user._id) }
    );
    res.json({ user: publicUser(user) });
  })
);

router.post(
  "/users/:id/license",
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Number(req.body.days || 30));
    const plan = req.body.plan || "standard";
    const license = buildLicense({ days, plan, grantedBy: req.userId });
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { license } }, { new: true }).lean();
    if (!user) throw httpError(404, "User not found");
    await logAudit(req, `Granted ${days}-day ${plan} license`, user.userCode || user.email);
    res.json({ user: publicUser(user) });
  })
);

router.post(
  "/users/:id/license/revoke",
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { "license.status": "revoked", "license.expiresAt": new Date() } },
      { new: true }
    ).lean();
    if (!user) throw httpError(404, "User not found");
    await logAudit(req, "Revoked login license", user.userCode || user.email);
    res.json({ user: publicUser(user) });
  })
);

router.get(
  "/licenses",
  asyncHandler(async (_req, res) => {
    const rows = await User.find({ role: { $ne: "admin" } }).sort({ createdAt: -1 }).limit(300).lean();
    res.json({
      licenses: rows.map((u) => ({
        id: String(u._id),
        userCode: u.userCode || "",
        name: u.provider?.businessName || u.name,
        email: u.email,
        role: u.role,
        license: licenseView(u),
      })),
    });
  })
);

router.get(
  "/skill-verification",
  asyncHandler(async (_req, res) => {
    await healPendingSkillsIntoPassport();
    const rows = await WorkerPassport.find({ "skills.verificationStatus": "pending" }).populate("workerId", "name email userCode").lean();
    res.json({ skills: rows.flatMap((row) => (row.skills || []).filter((skill) => skill.verificationStatus === "pending").map((skill) => ({ id: String(skill._id), workerId: String(row.workerId?._id || row.workerId), worker: row.workerId?.name || "Worker", email: row.workerId?.email || "", name: skill.name, level: skill.level, requestedAt: skill.verificationRequestedAt }))) });
  })
);

router.patch(
  "/skill-verification/:workerId/:skillId",
  asyncHandler(async (req, res) => {
    const status = ["verified", "rejected", "pending", "unverified"].includes(req.body.status) ? req.body.status : "rejected";
    const passport = await WorkerPassport.findOne({ workerId: req.params.workerId });
    const skill = passport?.skills.id(req.params.skillId);
    if (!skill) throw httpError(404, "Skill not found");
    skill.verificationStatus = status;
    skill.verified = status === "verified";
    skill.verifiedBy = status === "verified" ? req.userId : null;
    skill.verifiedAt = status === "verified" ? new Date() : null;
    skill.verificationNote = String(req.body.note || "").slice(0, 300);
    await passport.save();
    const worker = await syncUserSkillFromPassport(passport.workerId, skill);
    if (worker) await loadPassport(worker);
    await logAudit(req, `${status} worker skill`, `${skill.name} · ${req.params.workerId}`);
    await notifyMany([passport.workerId], { type: status === "verified" ? "success" : "info", text: `${skill.name} skill verification is ${status}.` });
    res.json({ ok: true, status });
  })
);

router.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.jobs === "true") {
      filter.status = { $in: [...BUSY_JOB_STATUSES, "completed", ...PAID_JOB_STATUSES, "cancelled", "declined"] };
    }
    const rows = await Request.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const people = await User.find({
      _id: { $in: rows.flatMap((r) => [r.customerId, r.providerId]).filter(Boolean) },
    })
      .select("name avatar role provider")
      .lean();
    const map = Object.fromEntries(people.map((u) => [String(u._id), u]));
    res.json({
      requests: rows.map((r) =>
        presentRequest(r, {
          customer: map[String(r.customerId)]
            ? { id: String(r.customerId), name: map[String(r.customerId)].provider?.businessName || map[String(r.customerId)].name }
            : null,
          provider: map[String(r.providerId)]
            ? { id: String(r.providerId), name: map[String(r.providerId)].provider?.businessName || map[String(r.providerId)].name }
            : null,
        })
      ),
    });
  })
);

router.get(
  "/reviews",
  asyncHandler(async (_req, res) => {
    const rows = await Review.find().sort({ createdAt: -1 }).limit(100).lean();
    const ids = rows.flatMap((r) => [r.customerId, r.providerId]);
    const jobIds = rows.map((r) => r.requestId).filter(Boolean);
    const [users, jobs] = await Promise.all([
      User.find({ _id: { $in: ids } }).select("name avatar provider").lean(),
      Request.find({ _id: { $in: jobIds } }).select("code category").lean(),
    ]);
    const map = Object.fromEntries(users.map((u) => [String(u._id), u]));
    const jobsMap = Object.fromEntries(jobs.map((j) => [String(j._id), j]));
    res.json({
      reviews: rows.map((r) => ({
        id: String(r._id),
        requestId: r.requestId ? String(r.requestId) : "",
        requestCode: jobsMap[String(r.requestId)]?.code || "",
        category: jobsMap[String(r.requestId)]?.category || "",
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        customer: map[String(r.customerId)]?.name || "Customer",
        provider: map[String(r.providerId)]?.provider?.businessName || map[String(r.providerId)]?.name || "Worker",
      })),
    });
  })
);

router.get(
  "/complaints",
  asyncHandler(async (_req, res) => {
    const rows = await Complaint.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ complaints: rows });
  })
);

router.patch(
  "/complaints/:id",
  asyncHandler(async (req, res) => {
    const doc = await Complaint.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
    if (!doc) throw httpError(404, "Complaint not found");
    await logAudit(req, `Complaint ${req.body.status}`, doc.code);
    res.json({ complaint: doc });
  })
);

router.get(
  "/transactions",
  asyncHandler(async (_req, res) => {
    const rows = await LedgerEntry.find().sort({ createdAt: -1 }).limit(200).lean();
    const totalsPaise = await LedgerEntry.aggregate([{ $group: { _id: "$type", total: { $sum: "$amountPaise" } } }]);
    const totals = Object.fromEntries(
      totalsPaise.map((t) => [t._id, paiseToRupees(t.total)])
    );
    res.json({
      financialMode: "development",
      label: SIMULATION_LABEL,
      transactions: rows.map((t) => ({
        _id: String(t._id),
        code: t.code,
        requestId: t.requestId ? String(t.requestId) : null,
        amount: paiseToRupees(t.amountPaise),
        amountPaise: t.amountPaise,
        kind: t.type,
        type: t.type,
        status: t.status,
        note: t.note,
        financialMode: t.financialMode || "development",
        simulated: true,
        createdAt: t.createdAt,
      })),
      totals: {
        ...totals,
        payment: totals[LEDGER_TYPES.JOB_PAYMENT] || 0,
        commission: totals[LEDGER_TYPES.COMMISSION] || 0,
        payout: totals[LEDGER_TYPES.WORKER_EARNING] || 0,
        compensation: totals[LEDGER_TYPES.COMPENSATION] || 0,
      },
    });
  })
);

router.get(
  "/notifications",
  asyncHandler(async (_req, res) => {
    const rows = await Notification.find().sort({ createdAt: -1 }).limit(80).lean();
    res.json({ notifications: rows });
  })
);

router.post(
  "/notifications",
  asyncHandler(async (req, res) => {
    const { text, role } = req.body || {};
    if (!text) throw httpError(400, "Message text is required");
    const filter = role && role !== "all" ? { role } : {};
    const users = await User.find(filter).select("_id").lean();
    await notifyMany(
      users.map((u) => u._id),
      { type: "info", text }
    );
    await logAudit(req, "Broadcast notification", `${users.length} users`);
    res.status(201).json({ sent: users.length });
  })
);

router.get(
  "/audit",
  asyncHandler(async (_req, res) => {
    const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      logs: rows.map((a) => ({
        _id: String(a._id),
        id: String(a._id),
        adminId: a.adminId ? String(a.adminId) : null,
        adminName: a.adminName,
        action: a.action,
        target: a.target || "",
        ip: a.ip || "",
        meta: a.meta || {},
        createdAt: a.createdAt,
      })),
    });
  })
);

router.get(
  "/analytics",
  asyncHandler(async (_req, res) => {
    const days = 14;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [byCategory, byCity, reqDays, userDays, allUsers] = await Promise.all([
      Request.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      User.aggregate([{ $group: { _id: "$city", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
      Request.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            jobs: { $sum: 1 },
            revenue: { $sum: "$estimatedAmount" },
          },
        },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, users: { $sum: 1 } } },
      ]),
      User.find({ role: { $ne: "admin" } }).select("license").lean(),
    ]);

    const reqMap = Object.fromEntries(reqDays.map((d) => [d._id, d]));
    const userMap = Object.fromEntries(userDays.map((d) => [d._id, d]));
    const byDay = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      byDay.push({
        _id: key,
        n: reqMap[key]?.jobs || 0,
        jobs: reqMap[key]?.jobs || 0,
        revenue: reqMap[key]?.revenue || 0,
        users: userMap[key]?.users || 0,
      });
    }

    const licenses = { active: 0, expired: 0, pending: 0, revoked: 0 };
    for (const u of allUsers) {
      const s = licenseView(u).status;
      licenses[s] = (licenses[s] || 0) + 1;
    }

    res.json({ byCategory, byCity, byDay, licenses });
  })
);

function presentSettings(doc) {
  const o = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  return {
    allowRegistrations: o.allowRegistrations,
    autoApproveProviders: o.autoApproveProviders,
    supportEmail: o.supportEmail,
    googleClientId: o.googleClientId || "",
    smtpHost: o.smtpHost || "smtp.gmail.com",
    smtpPort: o.smtpPort || 465,
    smtpUser: o.smtpUser || "",
    smtpPass: "",
    smtpPassSet: Boolean(o.smtpPass),
    commissionPercent: o.commissionPercent,
    travelCompensationInr: o.travelCompensationInr ?? 75,
    financialMode: "development",
    financialLabel: SIMULATION_LABEL,
    festivalName: o.festivalName || "",
    festivalCity: o.festivalCity || "",
    festivalNote: o.festivalNote || "",
    platformName: o.platformName,
    cancellationPolicy: o.cancellationPolicy || {},
  };
}

router.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const doc = await getSettings();
    const pendingMail = await MailJob.countDocuments({ status: { $in: ["pending", "failed"] } });
    res.json({ settings: presentSettings(doc), pendingMail });
  })
);

router.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const doc = await getSettings();
    const keys = [
      "allowRegistrations",
      "autoApproveProviders",
      "supportEmail",
      "googleClientId",
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "commissionPercent",
      "travelCompensationInr",
      "festivalName",
      "festivalCity",
      "festivalNote",
      "platformName",
    ];
    for (const k of keys) {
      if (req.body[k] !== undefined) doc[k] = req.body[k];
    }
    if (req.body.cancellationPolicy && typeof req.body.cancellationPolicy === "object") {
      doc.cancellationPolicy = { ...doc.cancellationPolicy?.toObject?.(), ...req.body.cancellationPolicy };
    }
    const nextPass = String(req.body.smtpPass || "").trim();
    if (nextPass && nextPass !== "********") doc.smtpPass = nextPass;
    await doc.save();
    clearSettingsCache();
    await logAudit(req, "Updated platform settings");
    if (doc.smtpPass) await sendPendingMail();
    const pendingMail = await MailJob.countDocuments({ status: { $in: ["pending", "failed"] } });
    res.json({ settings: presentSettings(doc), pendingMail });
  })
);

router.post(
  "/settings/test-mail",
  asyncHandler(async (req, res) => {
    const to = String(req.body.to || req.user.email || "").trim().toLowerCase();
    if (!to.includes("@")) throw httpError(400, "Enter an email to test");
    const ok = await sendMail({
      to,
      subject: "FixBuddy test email",
      html: `<p>FixBuddy mail is working. Contact support: ${to}</p>`,
    });
    if (!ok) throw httpError(503, "Add Gmail SMTP user and app password first");
    res.json({ ok: true, message: `Test mail sent to ${to}` });
  })
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const rows = await Category.find().sort({ name: 1 }).lean();
    res.json({ categories: rows });
  })
);

router.get(
  "/safety",
  asyncHandler(async (_req, res) => {
    const { SafetyIncident } = await import("../models/SafetyIncident.js");
    const rows = await SafetyIncident.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      incidents: rows.map((r) => ({
        id: String(r._id),
        workerId: String(r.workerId),
        requestId: r.requestId ? String(r.requestId) : null,
        type: r.type,
        description: r.description,
        status: r.status,
        lat: r.lat,
        lng: r.lng,
        createdAt: r.createdAt,
      })),
    });
  })
);

router.patch(
  "/safety/:id",
  asyncHandler(async (req, res) => {
    const { SafetyIncident } = await import("../models/SafetyIncident.js");
    const status = ["open", "reviewing", "resolved"].includes(req.body.status) ? req.body.status : "reviewing";
    const doc = await SafetyIncident.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!doc) throw httpError(404, "Incident not found");
    await logAudit(req, `Safety ${status}`, String(doc._id));
    res.json({ incident: { id: String(doc._id), status: doc.status } });
  })
);

router.get(
  "/crews",
  asyncHandler(async (_req, res) => {
    const { Crew } = await import("../models/Crew.js");
    const { presentCrew } = await import("../utils/serialize.js");
    const rows = await Crew.find().sort({ updatedAt: -1 }).limit(80).lean();
    res.json({
      crews: rows.map((c) => presentCrew(c)),
    });
  })
);

router.patch(
  "/crews/:id",
  asyncHandler(async (req, res) => {
    const { Crew } = await import("../models/Crew.js");
    const { presentCrew } = await import("../utils/serialize.js");
    const set = {};
    if (req.body.status && ["active", "suspended"].includes(req.body.status)) set.status = req.body.status;
    const crew = await Crew.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
    if (!crew) throw httpError(404, "Team not found");
    await logAudit(req, `Crew ${crew.status}`, crew.name);
    res.json({ crew: presentCrew(crew) });
  })
);

export default router;
