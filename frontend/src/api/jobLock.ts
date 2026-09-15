/** Existing Request.status groups — do not remap.
 *  unaccepted: matching, open, requested
 *  accepted: accepted, scheduled
 *  travelling: on_the_way
 *  arrived: arrived
 *  in_progress: otp_verified, in_progress
 *  completed (still focused until paid): completed
 *  paid/closed: payment_collected, customer_completed, reviewed
 *  cancelled: cancelled, declined
 */
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

export function isClosedStatus(status?: string | null) {
  return isPaidStatus(status) || status === "cancelled" || status === "declined";
}

export function canCancelJob(status?: string | null) {
  return CANCELLABLE_JOB_STATUSES.includes(String(status || ""));
}

export function isWorkerBusyConflict(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  return /already have an active/i.test(msg) || /Finish your current/i.test(msg);
}

export function isJobUnavailableConflict(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  return /no longer available/i.test(msg) || /already accepted/i.test(msg);
}

export function jobError(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  if (isWorkerBusyConflict(err)) {
    return "You already have an active FixBuddy job. Complete or cancel it before accepting another.";
  }
  if (/current job is active/i.test(msg)) {
    return "Your current job is active. Open your current job to continue.";
  }
  if (isJobUnavailableConflict(err)) {
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
    matching: "Searching",
    open: "Searching",
    requested: "Waiting for accept",
    accepted: "Accepted",
    scheduled: "Accepted",
    on_the_way: "On the way",
    arrived: "Arrived",
    otp_verified: "OTP verified",
    in_progress: "Work started",
    completed: "Work completed",
    payment_collected: "Closed",
    customer_completed: "Closed",
    reviewed: "Closed",
    cancelled: "Cancelled",
    declined: "Declined",
  };
  return map[String(status || "")] || String(status || "").replace(/_/g, " ");
}

/** Shared stepper: 0 Searching … 6 Completed. Values above length mean every step is done. */
export function jobStepIndex(status?: string | null) {
  const s = String(status || "");
  if (["reviewed", "customer_completed", "payment_collected", "completed"].includes(s)) return 7;
  if (s === "in_progress") return 5;
  if (s === "otp_verified") return 4;
  if (s === "arrived") return 3;
  if (s === "on_the_way") return 2;
  if (["accepted", "scheduled"].includes(s)) return 1;
  return 0;
}
