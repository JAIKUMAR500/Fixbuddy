export const ENGAGED_JOB_STATUSES = [
  "accepted",
  "scheduled",
  "on_the_way",
  "arrived",
  "otp_verified",
  "in_progress",
  "completed",
];

export const PENDING_JOB_STATUSES = ["matching", "open", "requested"];
export const PAID_JOB_STATUSES = ["payment_collected", "customer_completed", "reviewed"];
export const CANCELLABLE_JOB_STATUSES = [
  ...PENDING_JOB_STATUSES,
  "accepted",
  "scheduled",
  "on_the_way",
  "arrived",
  "otp_verified",
  "in_progress",
];

export function isEngagedStatus(status?: string | null) {
  return ENGAGED_JOB_STATUSES.includes(String(status || ""));
}

export function isPendingStatus(status?: string | null) {
  return PENDING_JOB_STATUSES.includes(String(status || ""));
}

export function isPaidStatus(status?: string | null) {
  return PAID_JOB_STATUSES.includes(String(status || ""));
}

export function canCancelJob(status?: string | null) {
  return CANCELLABLE_JOB_STATUSES.includes(String(status || ""));
}

export function jobError(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  if (/already have an active/i.test(msg) || /Finish your current/i.test(msg)) {
    return "You already have an active FixBuddy job. Complete or cancel it before accepting another.";
  }
  if (/current job is active/i.test(msg)) {
    return "Your current job is active. Open your current job to continue.";
  }
  if (/no longer available/i.test(msg) || /already accepted/i.test(msg)) {
    return "This job is no longer available.";
  }
  if (/do not have access|don't have access/i.test(msg)) {
    return "You don't have access to this job.";
  }
  if (/network|failed to fetch|offline/i.test(msg)) {
    return "Connection lost. We're keeping your active job safe.";
  }
  return msg || "Something went wrong. Please try again.";
}

export function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    matching: "Finding a worker",
    open: "Searching nearby",
    requested: "Waiting for accept",
    accepted: "Worker assigned",
    scheduled: "Scheduled",
    on_the_way: "On the way",
    arrived: "Arrived",
    otp_verified: "OTP verified",
    in_progress: "Work in progress",
    completed: "Work completed",
    payment_collected: "Paid",
    customer_completed: "Closed",
    reviewed: "Reviewed",
    cancelled: "Cancelled",
    declined: "Declined",
  };
  return map[String(status || "")] || String(status || "").replace(/_/g, " ");
}
