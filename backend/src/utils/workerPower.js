import { Request } from "../models/Request.js";
import { DailyTarget } from "../models/DailyTarget.js";
import { CancellationRecord } from "../models/CancellationRecord.js";
import { Crew } from "../models/Crew.js";
import { User } from "../models/User.js";
import { km, etaMinutes, PAID_JOB_STATUSES } from "./geo.js";

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function paidAmount(r) {
  return Number(r.workerQuote || r.estimatedAmount || 0);
}

export async function workerPaidJobs(workerId) {
  return Request.find({
    providerId: workerId,
    paymentStatus: "collected",
    status: { $in: [...PAID_JOB_STATUSES, "completed"] },
  })
    .select("category estimatedAmount workerQuote paymentCollectedAt completedAt startedAt scheduledAt createdAt status workPhotos delayReason")
    .lean();
}

export async function todayEarned(workerId) {
  const start = startOfDay();
  const rows = await Request.find({
    providerId: workerId,
    paymentStatus: "collected",
    paymentCollectedAt: { $gte: start },
  })
    .select("estimatedAmount workerQuote finance")
    .lean();
  return rows.reduce((s, r) => s + simulatedNetRupees(r), 0);
}

function simulatedNetRupees(r) {
  const net = Number(r.finance?.workerNetPaise);
  if (Number.isFinite(net) && net > 0) return Math.trunc(net / 100);
  return paidAmount(r);
}

export async function earnedInRange(workerId, from) {
  const rows = await Request.find({
    providerId: workerId,
    paymentStatus: "collected",
    paymentCollectedAt: { $gte: from },
  })
    .select("estimatedAmount workerQuote paymentCollectedAt")
    .lean();
  return {
    amount: rows.reduce((s, r) => s + paidAmount(r), 0),
    jobs: rows.length,
  };
}

export async function getOrCreateTarget(workerId, fallback = 1500) {
  const date = todayKey();
  let row = await DailyTarget.findOne({ workerId, date });
  if (!row) row = await DailyTarget.create({ workerId, date, amount: fallback });
  return row;
}

export function computePassport(user, jobs, cancelCount, onTimeCount) {
  const paid = jobs || [];
  const total = paid.length;
  const ratingAvg = user.provider?.ratingAvg || 0;
  const ratingCount = user.provider?.ratingCount || 0;
  const completed = user.provider?.completedJobs || total;
  const onTimePct = total ? Math.round((onTimeCount / total) * 100) : 100;
  const cancelPct = completed + cancelCount ? Math.round((cancelCount / Math.max(1, completed + cancelCount)) * 100) : 0;
  const byCategory = {};
  for (const j of paid) {
    const cat = j.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = { jobs: 0, amount: 0 };
    byCategory[cat].jobs += 1;
    byCategory[cat].amount += paidAmount(j);
  }
  return {
    jobs: total,
    completed,
    ratingAvg,
    ratingCount,
    onTimePct,
    cancelPct,
    byCategory,
    verified: !!user.provider?.verified,
  };
}

export function badgesFor(stats, crewLeader) {
  const list = [];
  if (stats.jobs >= 100) list.push({ id: "100-jobs", label: "100 Jobs Completed", icon: "🏆" });
  else if (stats.jobs >= 25) list.push({ id: "25-jobs", label: "25 Jobs Completed", icon: "🏆" });
  else if (stats.jobs >= 5) list.push({ id: "5-jobs", label: "Getting Started", icon: "🏅" });
  if (stats.ratingAvg >= 4.8 && stats.ratingCount >= 3) list.push({ id: "top-rated", label: "4.8+ Rated", icon: "⭐" });
  if (stats.onTimePct >= 90 && stats.jobs >= 3) list.push({ id: "on-time", label: "On-Time Professional", icon: "⏱️" });
  if (stats.cancelPct <= 5 && stats.jobs >= 5) list.push({ id: "reliable", label: "Reliable Worker", icon: "🤝" });
  if (crewLeader) list.push({ id: "leader", label: "Team Leader", icon: "👥" });
  if (stats.verified) list.push({ id: "verified", label: "Verified Professional", icon: "✓" });
  return list;
}

export function skillMatch(worker, category) {
  const cat = String(category || "").toLowerCase();
  const p = worker.provider || {};
  const hay = [
    p.category,
    p.description,
    ...(p.services || []).map((s) => (typeof s === "string" ? s : s?.name)),
    ...(p.skills || []).map((s) => s.name || s),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!cat) return 0.5;
  if (hay.includes(cat)) return 1;
  const tokens = cat.split(/\s+/).filter((t) => t.length > 3);
  if (tokens.some((t) => hay.includes(t))) return 0.7;
  return 0.25;
}

export function rankJobs(worker, jobs, { remaining = 0, sort = "recommended" } = {}) {
  const lat = worker.lat ?? worker.provider?.lat;
  const lng = worker.lng ?? worker.provider?.lng;
  const homeLat = worker.homeLat;
  const homeLng = worker.homeLng;
  const scored = jobs.map((j) => {
    const dist = km(lat, lng, j.lat, j.lng);
    const homeDist = km(j.lat, j.lng, homeLat, homeLng);
    const currentHome = km(lat, lng, homeLat, homeLng);
    const towardHome =
      homeDist != null && currentHome != null ? Math.max(0, currentHome - homeDist) : 0;
    const onWayHome = homeDist != null && currentHome != null ? homeDist <= currentHome + 0.4 : false;
    const amount = paidAmount(j);
    const skill = skillMatch(worker, j.category);
    const urgent = j.timing === "asap" || (j.tags || []).includes("urgent") ? 1 : 0;
    const earnFit = remaining > 0 ? Math.max(0, 1 - Math.abs(amount - remaining) / Math.max(remaining, 1)) : 0.5;
    const distScore = dist == null ? 0.4 : Math.max(0, 1 - dist / 20);
    const homeScore = onWayHome ? 12 + Math.min(towardHome, 8) : 0;
    const score = skill * 40 + distScore * 25 + earnFit * 20 + urgent * 10 + Math.min(amount / 2000, 1) * 5 + homeScore;
    return {
      ...j,
      distanceKm: dist,
      etaMinutes: etaMinutes(dist),
      homeKm: homeDist,
      onWayHome,
      amount,
      skill,
      urgent: !!urgent,
      score,
    };
  });
  if (sort === "nearest") scored.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
  else if (sort === "earning") scored.sort((a, b) => b.amount - a.amount);
  else if (sort === "shortest") scored.sort((a, b) => (a.etaMinutes || 30) - (b.etaMinutes || 30));
  else if (sort === "urgent") scored.sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.score - a.score);
  else if (sort === "home") scored.sort((a, b) => Number(b.onWayHome) - Number(a.onWayHome) || (a.homeKm ?? 99) - (b.homeKm ?? 99) || b.score - a.score);
  else scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function presentJobCard(j) {
  return {
    id: String(j._id || j.id),
    code: j.code,
    category: j.category,
    description: j.description,
    amount: j.amount ?? paidAmount(j),
    area: j.area,
    city: j.city,
    timing: j.timing,
    scheduledLabel: j.scheduledLabel,
    distanceKm: j.distanceKm != null ? Math.round(j.distanceKm * 10) / 10 : null,
    etaMinutes: j.etaMinutes ?? null,
    durationHours: 1.5,
    urgent: !!j.urgent,
    status: j.status,
    customerRating: j.customerRating || null,
    workersRequired: j.workersRequired || 1,
    score: j.score,
    onWayHome: !!j.onWayHome,
    homeKm: j.homeKm != null ? Math.round(j.homeKm * 10) / 10 : null,
  };
}

export function onTimeCount(jobs) {
  return (jobs || []).filter((j) => {
    if (j.delayReason) return true;
    if (!j.startedAt || !j.scheduledAt) return true;
    return new Date(j.startedAt).getTime() <= new Date(j.scheduledAt).getTime() + 15 * 60 * 1000;
  }).length;
}

export function applySkillVerification(user, jobs) {
  const skills = (user.provider?.skills || []).map((s) => ({
    _id: s._id,
    name: s.name,
    verified: !!s.verified,
    pending: !!s.pending,
  }));
  const catCounts = {};
  for (const j of jobs || []) {
    const c = String(j.category || "").toLowerCase();
    if (!c) continue;
    catCounts[c] = (catCounts[c] || 0) + 1;
  }
  let changed = false;
  for (const s of skills) {
    if (s.verified) continue;
    const n = catCounts[String(s.name || "").toLowerCase()] || 0;
    if (user.provider?.verified || n >= 3) {
      s.verified = true;
      s.pending = false;
      changed = true;
    }
  }
  return { skills, changed };
}

export function crewSplit(amount, crew, commissionPercent) {
  const gross = Number(amount || 0);
  const pct = Math.max(0, Math.min(40, Number(commissionPercent || 0)));
  const fee = Math.round((gross * pct) / 100);
  const net = Math.max(0, gross - fee);
  const active = (crew?.members || []).filter((m) => m.status === "active");
  const n = Math.max(1, active.length);
  const shares = active.map((m) => {
    let share = 0;
    if (crew.splitMode === "custom" && m.sharePercent > 0) share = Math.round((net * m.sharePercent) / 100);
    else if (crew.splitMode === "role") share = m.role === "leader" ? Math.round(net * 0.4) : Math.round((net * 0.6) / Math.max(1, n - 1));
    else share = Math.floor(net / n);
    return { userId: m.userId, role: m.role, amount: share };
  });
  const allocated = shares.reduce((s, x) => s + x.amount, 0);
  if (shares.length && allocated !== net) shares[0].amount += net - allocated;
  return { gross, fee, net, commissionPercent: pct, shares };
}

export function greetingFor() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export async function loadPassport(user) {
  const [jobs, cancelCount, crewLeader] = await Promise.all([
    workerPaidJobs(user._id),
    CancellationRecord.countDocuments({ workerId: user._id, cancelledBy: "worker" }),
    Crew.exists({ leaderId: user._id, status: "active" }),
  ]);
  const { skills, changed } = applySkillVerification(user, jobs);
  if (changed) {
    await User.updateOne({ _id: user._id }, { $set: { "provider.skills": skills } });
    user.provider = user.provider || {};
    user.provider.skills = skills;
  }
  const stats = computePassport(user, jobs, cancelCount, onTimeCount(jobs));
  const badges = badgesFor(stats, !!crewLeader);
  const proof = (jobs || [])
    .filter((j) => (j.workPhotos?.after || []).length || (j.workPhotos?.before || []).length)
    .slice(-8)
    .reverse()
    .map((j) => ({
      category: j.category,
      before: j.workPhotos?.before?.[0] || "",
      after: j.workPhotos?.after?.[0] || "",
    }));
  return { jobs, stats, badges, skills, proof };
}
