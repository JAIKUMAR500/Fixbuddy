import { Request } from "../models/Request.js";
import { LOCKED_JOB_STATUSES } from "./geo.js";

export const ENGAGED_JOB_STATUSES = [...LOCKED_JOB_STATUSES];
export const PENDING_JOB_STATUSES = ["matching", "open", "requested"];
export const CLOSED_JOB_STATUSES = ["payment_collected", "customer_completed", "reviewed", "cancelled", "declined"];
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

export function cancelPolicyFor(status, amount = 75) {
  const s = String(status || "");
  const traveling = ["on_the_way", "arrived", "otp_verified", "in_progress"].includes(s);
  const assigned = ["accepted", "scheduled"].includes(s);
  const pending = PENDING_JOB_STATUSES.includes(s);
  if (pending) {
    return {
      free: true,
      afterTravel: false,
      amount: 0,
      title: "Free cancellation",
      text: "Cancel anytime while a worker is still being found. No travel fee.",
    };
  }
  if (assigned) {
    return {
      free: true,
      afterTravel: false,
      amount: 0,
      title: "Free cancellation",
      text: "The worker has accepted but has not started travelling. You can cancel for free.",
    };
  }
  if (traveling) {
    return {
      free: false,
      afterTravel: true,
      amount: Number(amount || 75),
      title: "Travel compensation may apply",
      text: `The worker is already travelling. Cancelling now may add ₹${Number(amount || 75)} travel compensation for the worker.`,
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

export function approxCoord(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}
