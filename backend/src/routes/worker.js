import { Router } from "express";
import { User } from "../models/User.js";
import { Request } from "../models/Request.js";
import { Crew } from "../models/Crew.js";
import { requireRole } from "../middleware/auth.js";
import { asyncHandler, httpError } from "../utils/asyncHandler.js";
import { OPEN_JOB_STATUSES, km } from "../utils/geo.js";
import { findWorkerLockedJob, LOCK_MESSAGE } from "../utils/jobLock.js";
import { professionalPublic } from "../utils/serialize.js";
import {
  todayEarned,
  earnedInRange,
  getOrCreateTarget,
  rankJobs,
  presentJobCard,
  greetingFor,
  startOfDay,
  todayKey,
  loadPassport,
  upsertPassportSkill,
  filterJobsForWorker,
  workerHasSkills,
  workerSkillLabels,
} from "../utils/workerPower.js";

const router = Router();
router.use(requireRole("worker"));

async function passportBundle(user) {
  return loadPassport(user);
}

async function openJobsFor(worker) {
  const filter = {
    status: { $in: OPEN_JOB_STATUSES },
    declinedBy: { $ne: worker._id },
    $or: [{ providerId: null }, { providerId: { $exists: false } }],
  };
  const rows = await Request.find(filter).sort({ createdAt: -1 }).limit(120).lean();
  const available = worker.provider?.nextJobAvailable !== false;
  if (!available) return [];
  return filterJobsForWorker(worker, rows);
}

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const user = req.user;
    const fallback = user.provider?.dailyTargetAmount || 1500;
    const [target, earned, pack, crew, nearby, todayJobs, locked, settings] = await Promise.all([
      getOrCreateTarget(user._id, fallback),
      todayEarned(user._id),
      passportBundle(user),
      Crew.findOne({ "members.userId": user._id, status: "active" }).lean(),
      openJobsFor(user),
      Request.countDocuments({
        providerId: user._id,
        paymentStatus: "collected",
        paymentCollectedAt: { $gte: startOfDay() },
      }),
      findWorkerLockedJob(user._id),
      import("../models/PlatformSettings.js").then((m) => m.getSettings()),
    ]);
    const remaining = Math.max(0, target.amount - earned);
    const ranked = locked ? [] : rankJobs(user, nearby, { remaining, sort: "recommended" });
    const best = ranked[0] ? presentJobCard(ranked[0]) : null;
    const pct = target.amount ? Math.min(100, Math.round((earned / target.amount) * 100)) : 0;
    const city = String(user.city || "");
    const festival =
      settings.festivalName &&
      (!settings.festivalCity || !city || String(settings.festivalCity).toLowerCase() === city.toLowerCase())
        ? {
            name: settings.festivalName,
            city: settings.festivalCity || "",
            note: settings.festivalNote || `Festival demand is high. More ${user.provider?.category || "service"} jobs may be available.`,
          }
        : null;
    res.json({
      greeting: greetingFor(),
      available: user.provider?.available !== false,
      nextJobAvailable: user.provider?.nextJobAvailable !== false,
      todayJobs,
      locked: !!locked,
      activeJob: locked
        ? {
            id: String(locked._id),
            code: locked.code,
            category: locked.category,
            status: locked.status,
            area: locked.area || locked.city,
          }
        : null,
      target: {
        date: target.date,
        amount: target.amount,
        earned,
        remaining,
        percent: pct,
        achieved: earned >= target.amount,
      },
      bestJob: best,
      nearbyCount: ranked.length,
      recommended: ranked.slice(0, 3).map(presentJobCard),
      crew: crew
        ? {
            id: String(crew._id),
            name: crew.name,
            members: (crew.members || []).filter((m) => m.status === "active").length,
            ratingAvg: crew.ratingAvg || 0,
            completedJobs: crew.completedJobs || 0,
          }
        : null,
      passport: {
        verified: pack.stats.verified,
        jobs: pack.stats.jobs,
        ratingAvg: pack.stats.ratingAvg,
        badges: pack.badges,
      },
      festival,
      hasSkills: workerHasSkills(user),
      skills: workerSkillLabels(user),
    });
  })
);

router.get(
  "/daily-target",
  asyncHandler(async (req, res) => {
    const fallback = req.user.provider?.dailyTargetAmount || 1500;
    const target = await getOrCreateTarget(req.userId, fallback);
    const earned = await todayEarned(req.userId);
    const remaining = Math.max(0, target.amount - earned);
    const jobsCompleted = await Request.countDocuments({
      providerId: req.userId,
      paymentStatus: "collected",
      paymentCollectedAt: { $gte: startOfDay() },
    });
    res.json({
      target: {
        date: target.date,
        amount: target.amount,
        earned,
        remaining,
        percent: target.amount ? Math.min(100, Math.round((earned / target.amount) * 100)) : 0,
        achieved: earned >= target.amount,
        jobsCompleted,
      },
    });
  })
);

async function saveTarget(req, res) {
  const amount = Math.round(Number(req.body.amount || req.body.target || 0));
  if (!amount || amount < 100 || amount > 100000) throw httpError(400, "Enter a target between ₹100 and ₹1,00,000");
  const date = todayKey();
  const row = await getOrCreateTarget(req.userId, amount);
  row.amount = amount;
  await row.save();
  await User.updateOne({ _id: req.userId }, { $set: { "provider.dailyTargetAmount": amount } });
  const earned = await todayEarned(req.userId);
  res.json({
    target: {
      date,
      amount,
      earned,
      remaining: Math.max(0, amount - earned),
      percent: Math.min(100, Math.round((earned / amount) * 100)),
      achieved: earned >= amount,
    },
  });
}

router.post("/daily-target", asyncHandler(saveTarget));
router.put("/daily-target", asyncHandler(saveTarget));

router.get(
  "/earnings/history",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const yesterday = startOfDay(new Date(now.getTime() - 86400000));
    const week = startOfDay(new Date(now.getTime() - 7 * 86400000));
    const month = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const [today, yest, thisWeek, thisMonth] = await Promise.all([
      earnedInRange(req.userId, startOfDay()),
      earnedInRange(req.userId, yesterday).then(async (full) => {
        const todayPart = await earnedInRange(req.userId, startOfDay());
        return { amount: Math.max(0, full.amount - todayPart.amount), jobs: Math.max(0, full.jobs - todayPart.jobs) };
      }),
      earnedInRange(req.userId, week),
      earnedInRange(req.userId, month),
    ]);
    res.json({ history: { today, yesterday: yest, week: thisWeek, month: thisMonth } });
  })
);

router.get(
  "/nearby-jobs",
  asyncHandler(async (req, res) => {
    if (req.user.provider?.available === false) {
      return res.json({ jobs: [], message: "Go online to see nearby jobs.", remaining: 0, gps: false, nextJobAvailable: false });
    }
    const locked = await findWorkerLockedJob(req.userId);
    if (locked) {
      return res.json({
        jobs: [],
        remaining: 0,
        gps: req.user.lat != null && req.user.lng != null,
        nextJobAvailable: false,
        locked: true,
        activeJobId: String(locked._id),
        message: LOCK_MESSAGE,
      });
    }
    const sort = String(req.query.sort || "recommended");
    const target = await getOrCreateTarget(req.userId, req.user.provider?.dailyTargetAmount || 1500);
    const earned = await todayEarned(req.userId);
    const remaining = Math.max(0, target.amount - earned);
    const jobs = rankJobs(req.user, await openJobsFor(req.user), { remaining, sort });
    const skills = workerSkillLabels(req.user);
    res.json({
      jobs: jobs.map(presentJobCard),
      remaining,
      gps: req.user.lat != null && req.user.lng != null,
      nextJobAvailable: req.user.provider?.nextJobAvailable !== false,
      locked: false,
      hasSkills: workerHasSkills(req.user),
      skills,
    });
  })
);

router.get(
  "/recommended-jobs",
  asyncHandler(async (req, res) => {
    const locked = await findWorkerLockedJob(req.userId);
    if (locked) {
      return res.json({
        best: null,
        jobs: [],
        remaining: 0,
        target: req.user.provider?.dailyTargetAmount || 1500,
        earned: 0,
        locked: true,
        activeJobId: String(locked._id),
        message: LOCK_MESSAGE,
      });
    }
    const target = await getOrCreateTarget(req.userId, req.user.provider?.dailyTargetAmount || 1500);
    const earned = await todayEarned(req.userId);
    const remaining = Math.max(0, target.amount - earned);
    const jobs = rankJobs(req.user, await openJobsFor(req.user), { remaining, sort: "recommended" });
    const best = jobs[0] ? presentJobCard(jobs[0]) : null;
    res.json({
      best,
      jobs: jobs.slice(0, 8).map(presentJobCard),
      remaining,
      target: target.amount,
      earned,
    });
  })
);

router.put(
  "/availability",
  asyncHandler(async (req, res) => {
    const set = {};
    if (req.body.available != null) set["provider.available"] = !!req.body.available;
    if (req.body.nextJobAvailable != null) set["provider.nextJobAvailable"] = !!req.body.nextJobAvailable;
    if (!Object.keys(set).length) throw httpError(400, "Nothing to update");
    const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { new: true }).lean();
    res.json({
      available: user.provider?.available !== false,
      nextJobAvailable: user.provider?.nextJobAvailable !== false,
    });
  })
);

router.get(
  "/passport",
  asyncHandler(async (req, res) => {
    const pack = await passportBundle(req.user);
    res.json({
      passport: {
        ...professionalPublic(req.user, { ...pack.stats, badges: pack.badges }),
        skills: pack.skills,
        stats: pack.stats,
        badges: pack.badges,
        proof: pack.proof || [],
      },
    });
  })
);

router.put(
  "/passport",
  asyncHandler(async (req, res) => {
    const set = {};
    if (req.body.bio != null) set["provider.passportBio"] = String(req.body.bio).slice(0, 600);
    if (req.body.experience != null) set["provider.experience"] = String(req.body.experience).slice(0, 80);
    if (Array.isArray(req.body.languages)) set["provider.languages"] = req.body.languages.map(String).slice(0, 8);
    if (Array.isArray(req.body.serviceAreas)) set["provider.serviceAreas"] = req.body.serviceAreas.map(String).slice(0, 12);
    if (!Object.keys(set).length) throw httpError(400, "Nothing to update");
    const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { new: true }).lean();
    const pack = await passportBundle(user);
    res.json({
      passport: { ...professionalPublic(user, { ...pack.stats, badges: pack.badges }), skills: pack.skills, stats: pack.stats, badges: pack.badges },
    });
  })
);

router.post(
  "/skills",
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "Skill name is required");
    const user = await User.findById(req.userId);
    user.provider = user.provider || {};
    const skills = user.provider.skills || [];
    if (skills.some((s) => String(s.name).toLowerCase() === name.toLowerCase())) {
      throw httpError(409, "That skill is already on your passport");
    }
    skills.push({ name, verified: false, pending: false });
    user.provider.skills = skills;
    await user.save();
    const added = skills[skills.length - 1];
    await upsertPassportSkill(user._id, added);
    res.status(201).json({
      skills: skills.map((s) => ({ id: String(s._id || s.name), name: s.name, verified: !!s.verified, pending: !!s.pending })),
    });
  })
);

router.post(
  "/skills/:id/verify",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    const skills = user.provider?.skills || [];
    const skill = skills.id(req.params.id) || skills.find((s) => String(s._id) === req.params.id || s.name === req.params.id);
    if (!skill) throw httpError(404, "Skill not found");
    if (skill.verified) return res.json({ skill: { id: String(skill._id), name: skill.name, verified: true, pending: false } });
    skill.pending = true;
    await user.save();
    await upsertPassportSkill(user._id, skill);
    res.json({ skill: { id: String(skill._id), name: skill.name, verified: false, pending: true } });
  })
);

router.get(
  "/badges",
  asyncHandler(async (req, res) => {
    const pack = await passportBundle(req.user);
    res.json({ badges: pack.badges });
  })
);

router.get(
  "/idle-status",
  asyncHandler(async (req, res) => {
    const locked = await findWorkerLockedJob(req.userId);
    if (locked) {
      return res.json({ idle: false, minutes: 0, estimateInr: 0, message: "You're on an active job.", nextJob: null });
    }
    const last = await Request.findOne({
      providerId: req.userId,
      $or: [{ paymentStatus: "collected" }, { status: "cancelled" }],
    })
      .sort({ updatedAt: -1 })
      .select("paymentCollectedAt cancelledAt updatedAt")
      .lean();
    const from = last?.paymentCollectedAt || last?.cancelledAt || last?.updatedAt;
    const minutes = from ? Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 60000)) : 0;
    const target = await getOrCreateTarget(req.userId, req.user.provider?.dailyTargetAmount || 1500);
    const perMinute = Number(target.amount || 1500) / (8 * 60);
    const estimateInr = Math.round(minutes * perMinute);
    const remaining = Math.max(0, target.amount - (await todayEarned(req.userId)));
    const ranked = rankJobs(req.user, await openJobsFor(req.user), { remaining, sort: "recommended" });
    const next = ranked[0] ? presentJobCard(ranked[0]) : null;
    res.json({
      idle: minutes > 0,
      minutes,
      estimateInr,
      perMinute: Math.round(perMinute * 100) / 100,
      target: target.amount,
      message:
        minutes > 0
          ? `${minutes} min idle · ≈ ₹${estimateInr} away from today's target`
          : "You're ready for the next job.",
      nextJob: next,
    });
  })
);

router.get(
  "/job-demand-heatmap",
  asyncHandler(async (req, res) => {
    const worker = req.user;
    const category = req.query.category ? String(req.query.category).trim() : null;
    const priority = req.query.priority ? String(req.query.priority).trim() : null;
    const maxDistanceKm = Number(req.query.maxDistanceKm || 30);

    const filter = {
      status: { $in: OPEN_JOB_STATUSES },
      declinedBy: { $ne: worker._id },
      $or: [{ providerId: null }, { providerId: { $exists: false } }],
    };
    if (category) filter.category = new RegExp(`^${category}$`, "i");
    if (priority) filter.priority = priority;

    const rows = await Request.find(filter)
      .select("category priority area city lat lng createdAt")
      .limit(200)
      .lean();

    const clusterMap = new Map();
    const wLat = worker.lat ?? worker.provider?.lat ?? 12.9716;
    const wLng = worker.lng ?? worker.provider?.lng ?? 77.5946;

    for (const r of rows) {
      if (r.lat == null || r.lng == null) continue;
      const dist = km(wLat, wLng, r.lat, r.lng);
      if (dist != null && dist > maxDistanceKm) continue;

      const gridLat = Math.round(r.lat * 50) / 50;
      const gridLng = Math.round(r.lng * 50) / 50;
      const key = `${gridLat}_${gridLng}`;

      let cluster = clusterMap.get(key);
      if (!cluster) {
        cluster = {
          lat: gridLat,
          lng: gridLng,
          area: r.area || r.city || "Bangalore",
          count: 0,
          categories: {},
          priorities: {},
        };
        clusterMap.set(key, cluster);
      }
      cluster.count += 1;
      cluster.categories[r.category] = (cluster.categories[r.category] || 0) + 1;
      const p = r.priority || "normal";
      cluster.priorities[p] = (cluster.priorities[p] || 0) + 1;
    }

    const clusters = Array.from(clusterMap.values()).map((c) => {
      const topEntries = Object.entries(c.categories || {}).sort((a, b) => b[1] - a[1]);
      const emergency = c.priorities["emergency"] || 0;
      const urgent = c.priorities["urgent"] || 0;
      const normal = c.priorities["normal"] || 0;
      return {
        clusterId: `${c.lat}_${c.lng}`,
        center: { lat: c.lat, lng: c.lng },
        lat: c.lat,
        lng: c.lng,
        area: c.area,
        count: c.count,
        activeDemandCount: c.count,
        approxRadiusKm: 2,
        categories: c.categories || {},
        topCategories: topEntries.slice(0, 3).map(([name, count]) => ({ name, count })),
        topCategory: topEntries[0] ? topEntries[0][0] : "General Services",
        emergencyCount: emergency,
        urgentCount: urgent,
        priorityCounts: {
          emergency,
          urgent,
          normal,
        },
      };
    });

    res.json({
      workerLocation: { lat: wLat, lng: wLng },
      totalJobs: rows.length,
      totalActiveDemands: rows.length,
      clusters,
    });
  })
);

router.get(
  "/reliability-profile",
  asyncHandler(async (req, res) => {
    const workerId = req.userId;
    const [completedJobs, cancelledWorkerJobs, allWorkerJobs, pack, reviews] = await Promise.all([
      Request.countDocuments({
        providerId: workerId,
        status: { $in: ["completed", "payment_collected", "customer_completed", "reviewed"] },
      }),
      Request.countDocuments({
        providerId: workerId,
        status: "cancelled",
        cancelledBy: "worker",
      }),
      Request.find({
        providerId: workerId,
        status: { $in: ["completed", "payment_collected", "customer_completed", "reviewed"] },
      })
        .select("customerId scheduledAt arrivedAt timeline acceptedAt")
        .lean(),
      passportBundle(req.user),
      import("../models/Review.js").then((m) =>
        m.Review.find({ providerId: workerId }).select("rating").lean()
      ),
    ]);

    const customerCounts = {};
    for (const j of allWorkerJobs) {
      if (j.customerId) {
        const cid = String(j.customerId);
        customerCounts[cid] = (customerCounts[cid] || 0) + 1;
      }
    }
    const repeatCustomerCount = Object.values(customerCounts).filter((c) => c > 1).length;
    const totalAssigned = completedJobs + cancelledWorkerJobs;
    const cancellationRate = totalAssigned > 0 ? Math.round((cancelledWorkerJobs / totalAssigned) * 100) : 0;

    let onTimeCount = 0;
    for (const j of allWorkerJobs) {
      if (j.arrivedAt && j.scheduledAt) {
        const diffMin = (new Date(j.arrivedAt).getTime() - new Date(j.scheduledAt).getTime()) / 60000;
        if (diffMin <= 15) onTimeCount += 1;
      } else {
        onTimeCount += 1;
      }
    }
    const onTimePct = completedJobs > 0 ? Math.min(100, Math.round((onTimeCount / completedJobs) * 100)) : 100;
    const verifiedSkillsCount = (pack.passport?.skills || []).filter((s) => s.verified).length;

    const avgRating = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) * 10) / 10
      : req.user.provider?.ratingAvg || 5.0;

    const milestones = [
      {
        id: "first_job",
        title: "First Job Completed",
        description: "Successfully finished your first service job",
        icon: "🛠️",
        earned: completedJobs >= 1,
        achieved: completedJobs >= 1,
        progress: completedJobs,
        threshold: 1,
        target: 1,
        current: completedJobs,
      },
      {
        id: "ten_jobs",
        title: "10 Jobs Completed",
        description: "Milestone for reliable active workers",
        icon: "⭐",
        earned: completedJobs >= 10,
        achieved: completedJobs >= 10,
        progress: completedJobs,
        threshold: 10,
        target: 10,
        current: completedJobs,
      },
      {
        id: "fifty_jobs",
        title: "50 Jobs Completed",
        description: "Experienced service professional",
        icon: "👑",
        earned: completedJobs >= 50,
        achieved: completedJobs >= 50,
        progress: completedJobs,
        threshold: 50,
        target: 50,
        current: completedJobs,
      },
      {
        id: "repeat_customers",
        title: "Repeat Customers",
        description: "Served multiple repeat clients",
        icon: "🤝",
        earned: repeatCustomerCount >= 2,
        achieved: repeatCustomerCount >= 2,
        progress: repeatCustomerCount,
        threshold: 2,
        target: 2,
        current: repeatCustomerCount,
      },
      {
        id: "skill_verified",
        title: "Verified Skills",
        description: "Has one or more verified skills in Passport",
        icon: "📜",
        earned: verifiedSkillsCount >= 1,
        achieved: verifiedSkillsCount >= 1,
        progress: verifiedSkillsCount,
        threshold: 1,
        target: 1,
        current: verifiedSkillsCount,
      },
      {
        id: "high_punctuality",
        title: "Punctuality Star",
        description: "Maintained 90%+ on-time arrival across jobs",
        icon: "⚡",
        earned: completedJobs >= 3 && onTimePct >= 90,
        achieved: completedJobs >= 3 && onTimePct >= 90,
        progress: completedJobs >= 3 ? onTimePct : completedJobs,
        threshold: completedJobs >= 3 ? 90 : 3,
        target: 90,
        current: onTimePct,
      },
    ];

    const factualMetrics = {
      completedJobs,
      cancelledJobs: cancelledWorkerJobs,
      completionRate: totalAssigned > 0 ? Math.round((completedJobs / totalAssigned) * 100) : 100,
      onTimeArrivalRate: onTimePct,
      repeatCustomerCount,
      verifiedSkillsCount,
      totalRatedJobs: reviews.length,
      averageRating: avgRating,
    };

    res.json({
      factualMetrics,
      reliability: {
        completedJobs,
        onTimePct,
        cancellationCount: cancelledWorkerJobs,
        cancellationRate,
        repeatCustomerCount,
        verifiedSkillsCount,
        rating: avgRating,
        reviewCount: reviews.length,
      },
      milestones,
      worker: {
        id: String(req.user._id),
        name: req.user.provider?.businessName || req.user.name || "FixBuddy Professional",
        verified: Boolean(req.user.provider?.verified),
        category: req.user.provider?.category || "Home Services",
        experience: req.user.provider?.experience || "",
        skills: (req.user.provider?.skills || []).map((s) => ({
          id: String(s._id || s.name),
          name: s.name,
          verified: Boolean(s.verified),
          pending: Boolean(s.pending),
        })),
      },
    });
  })
);

router.get(
  "/notification-preferences",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId).select("notificationPreferences").lean();
    const defaults = {
      nearbyJobs: true,
      onlyMySkills: false,
      emergencyJobs: true,
      maxDistanceKm: 25,
      minJobValue: 0,
      scheduledJobs: true,
    };
    const prefs = {
      ...defaults,
      ...(user?.notificationPreferences?.workerJobAlerts || {}),
    };
    res.json({ preferences: prefs });
  })
);

router.put(
  "/notification-preferences",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const update = {
      nearbyJobs: body.nearbyJobs !== false,
      onlyMySkills: !!body.onlyMySkills,
      emergencyJobs: body.emergencyJobs !== false,
      maxDistanceKm: Math.max(1, Math.min(100, Number(body.maxDistanceKm || 25))),
      minJobValue: Math.max(0, Number(body.minJobValue || 0)),
      scheduledJobs: body.scheduledJobs !== false,
    };
    const doc = await User.findByIdAndUpdate(
      req.userId,
      { $set: { "notificationPreferences.workerJobAlerts": update } },
      { new: true }
    ).select("notificationPreferences");
    res.json({ ok: true, preferences: doc.notificationPreferences?.workerJobAlerts || update });
  })
);

export default router;
