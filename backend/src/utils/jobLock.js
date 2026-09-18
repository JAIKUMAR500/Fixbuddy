import { Request } from "../models/Request.js";
import { WorkerLock } from "../models/WorkerLock.js";
import { LOCKED_JOB_STATUSES } from "./geo.js";
import { httpError } from "./asyncHandler.js";

/** Existing Request.status groups — do not remap or duplicate. */
export const ENGAGED_JOB_STATUSES = [...LOCKED_JOB_STATUSES];
export const PENDING_JOB_STATUSES = ["matching", "open", "requested"];
export const CLOSED_JOB_STATUSES = ["payment_collected", "customer_completed", "reviewed", "cancelled", "declined"];
export const CANCELLABLE_JOB_STATUSES = [
  ...PENDING_JOB_STATUSES,
  "accepted",
  "scheduled",
  "on_the_way",
  "arrived",
  "otp_verified",
  "in_progress",
  "completed",
];
export const DELAY_REASONS = ["HEAVY_RAIN", "FOG", "ROAD_BLOCK", "TRAFFIC", "OTHER"];

export const LOCK_MESSAGE = "You already have an active FixBuddy job. Complete or cancel it before accepting another.";
export const CUSTOMER_FOCUS_MESSAGE = "Your current job is active. Open your current job to continue.";
export const UNAVAILABLE_MESSAGE = "This job is no longer available.";
export const NO_ACCESS_MESSAGE = "You don't have access to this job.";

export function lockedJobFilter(userId) {
  return {
    status: { $in: LOCKED_JOB_STATUSES },
    $or: [{ providerId: userId }, { crewMemberIds: userId }],
  };
}

export async function findWorkerLockedJob(userId) {
  const stale = await WorkerLock.findOne({ userId }).lean();
  if (stale) {
    const held = await Request.findById(stale.jobId).select("status providerId crewMemberIds").lean();
    const stillEngaged = held && isEngagedJobStatus(held.status);
    const stillAssigned =
      stillEngaged &&
      (String(held.providerId || "") === String(userId) ||
        (held.crewMemberIds || []).some((id) => String(id) === String(userId)));
    if (!stillAssigned) {
      await WorkerLock.deleteOne({ _id: stale._id });
    }
  }
  return Request.findOne(lockedJobFilter(userId)).sort({ updatedAt: -1 }).lean();
}

export async function findCurrentJob(user, userId) {
  if (user?.role === "worker") {
    return findWorkerLockedJob(userId);
  }
  return Request.findOne({
    customerId: userId,
    status: { $in: ENGAGED_JOB_STATUSES },
  })
    .sort({ updatedAt: -1 })
    .lean();
}

export function isEngagedJobStatus(status) {
  return ENGAGED_JOB_STATUSES.includes(String(status || ""));
}

export function canCancelJob(status) {
  return CANCELLABLE_JOB_STATUSES.includes(String(status || ""));
}

export function cancelPolicyFor(status, amount = 75) {
  const s = String(status || "");
  const traveling = ["on_the_way", "arrived", "otp_verified", "in_progress", "completed"].includes(s);
  const assigned = ["accepted", "scheduled"].includes(s);
  const pending = PENDING_JOB_STATUSES.includes(s);
  if (pending) {
    return {
      free: true,
      afterTravel: false,
      amount: 0,
      title: "Free cancellation",
      text: "Cancel once while a worker is still being found. No travel fee.",
    };
  }
  if (assigned) {
    return {
      free: true,
      afterTravel: false,
      amount: 0,
      title: "Free cancellation",
      text: "The worker has accepted but has not started travelling. You can cancel once for free.",
    };
  }
  if (traveling) {
    return {
      free: false,
      afterTravel: true,
      amount: Number(amount || 75),
      title: "Travel compensation may apply",
      text: `You can still cancel once after arrival or after work starts. Cancelling now may add ₹${Number(amount || 75)} travel compensation for the worker.`,
    };
  }
  return {
    free: false,
    afterTravel: false,
    amount: 0,
    title: "Cancellation",
    text: "This job can no longer be cancelled.",
  };
}

export function delayLabel(reason) {
  const map = {
    HEAVY_RAIN: "heavy rain",
    FOG: "fog",
    ROAD_BLOCK: "a road block",
    TRAFFIC: "traffic",
    OTHER: "a verified delay",
  };
  return map[reason] || "a delay";
}

export function firstName(name) {
  return String(name || "Worker").trim().split(/\s+/)[0] || "Worker";
}

/** Round coordinates to ~1.1km so watch links never expose an exact pin. */
export function approxCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function isDuplicateKeyError(err) {
  return Boolean(err && (err.code === 11000 || err.code === 11001));
}

export function claimableJobFilter(jobId, userId) {
  return {
    _id: jobId,
    status: { $in: PENDING_JOB_STATUSES },
    declinedBy: { $ne: userId },
    $or: [{ providerId: null }, { providerId: { $exists: false } }, { providerId: userId }],
  };
}

export async function acquireWorkerLock(userId, jobId) {
  try {
    await WorkerLock.create({ userId, jobId });
    return { created: true, same: false };
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const existing = await WorkerLock.findOne({ userId }).lean();
    if (existing && String(existing.jobId) === String(jobId)) return { created: false, same: true };
    if (existing) {
      const held = await Request.findById(existing.jobId).select("status providerId crewMemberIds").lean();
      const pendingHold = held && PENDING_JOB_STATUSES.includes(held.status);
      const stillEngaged = held && isEngagedJobStatus(held.status);
      const stillAssigned =
        pendingHold ||
        (stillEngaged &&
          (String(held.providerId || "") === String(userId) ||
            (held.crewMemberIds || []).some((id) => String(id) === String(userId))));
      if (!stillAssigned) {
        await WorkerLock.deleteOne({ _id: existing._id });
        try {
          await WorkerLock.create({ userId, jobId });
          return { created: true, same: false };
        } catch (retryErr) {
          if (!isDuplicateKeyError(retryErr)) throw retryErr;
        }
      }
    }
    throw httpError(409, LOCK_MESSAGE);
  }
}

export async function rollbackCreatedLocks(userIds, jobId) {
  if (!jobId || !userIds?.length) return;
  await WorkerLock.deleteMany({ userId: { $in: userIds }, jobId });
}

export async function acquireWorkerLocks(userIds, jobId) {
  const unique = [...new Set((userIds || []).map(String).filter(Boolean))];
  const created = [];
  try {
    for (const id of unique) {
      const result = await acquireWorkerLock(id, jobId);
      if (result.created) created.push(id);
    }
    return { created };
  } catch (err) {
    await rollbackCreatedLocks(created, jobId);
    throw err;
  }
}

export async function releaseWorkerLock(userId, jobId) {
  const filter = { userId };
  if (jobId) filter.jobId = jobId;
  await WorkerLock.deleteOne(filter);
}

export async function releaseLocksForJob(jobId) {
  if (!jobId) return;
  await WorkerLock.deleteMany({ jobId });
}

export async function healWorkerLock(userId, jobId) {
  await WorkerLock.findOneAndUpdate(
    { userId },
    { $set: { jobId, userId } },
    { upsert: true }
  );
}
