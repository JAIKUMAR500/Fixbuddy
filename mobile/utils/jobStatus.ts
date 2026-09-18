/** Mirror frontend/src/api/jobLock.ts — do not invent statuses. */
export const ENGAGED_JOB_STATUSES = [
  "accepted",
  "scheduled",
  "on_the_way",
  "arrived",
  "otp_verified",
  "in_progress",
  "completed",
] as const;

export const PENDING_JOB_STATUSES = ["matching", "open", "requested"] as const;
export const PAID_JOB_STATUSES = ["payment_collected", "customer_completed", "reviewed"] as const;

export const TIMELINE = [
  { status: "accepted", label: "Accepted" },
  { status: "on_the_way", label: "On the way" },
  { status: "arrived", label: "Arrived" },
  { status: "otp_verified", label: "OTP verified" },
  { status: "in_progress", label: "Work started" },
  { status: "completed", label: "Completed" },
] as const;

export function isEngagedStatus(status?: string | null) {
  return ENGAGED_JOB_STATUSES.includes(String(status || "") as (typeof ENGAGED_JOB_STATUSES)[number]);
}

export function isPendingStatus(status?: string | null) {
  return PENDING_JOB_STATUSES.includes(String(status || "") as (typeof PENDING_JOB_STATUSES)[number]);
}

export function isPaidStatus(status?: string | null) {
  return PAID_JOB_STATUSES.includes(String(status || "") as (typeof PAID_JOB_STATUSES)[number]);
}

export function isClosedStatus(status?: string | null) {
  return isPaidStatus(status) || status === "cancelled" || status === "declined";
}

export function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    matching: "Finding workers",
    open: "Open",
    requested: "Requested",
    accepted: "Accepted",
    scheduled: "Scheduled",
    on_the_way: "On the way",
    arrived: "Arrived",
    otp_verified: "OTP verified",
    in_progress: "In progress",
    completed: "Completed",
    payment_collected: "Paid",
    customer_completed: "Closed",
    reviewed: "Reviewed",
    cancelled: "Cancelled",
    declined: "Declined",
  };
  return map[String(status || "")] || String(status || "Unknown");
}
