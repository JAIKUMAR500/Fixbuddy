/**
 * Job lifecycle lives in the existing backend.
 * GET /api/requests/current-job is the source of truth.
 * Do not invent a second status system in Android.
 */
export const CURRENT_JOB = "/requests/current-job";

export const JOB_ACTIONS = {
  create: "POST /requests",
  accept: "POST /requests/:id/accept",
  enroute: "POST /requests/:id/enroute",
  arrive: "POST /requests/:id/arrive",
  otp: "POST /requests/:id/otp",
  start: "POST /requests/:id/start",
  complete: "POST /requests/:id/complete",
  collect: "POST /requests/:id/collect",
  cancel: "POST /requests/:id/cancel",
} as const;

export const ENGAGED_STATUSES = [
  "accepted",
  "enroute",
  "arrived",
  "otp_pending",
  "in_progress",
  "completed",
] as const;

export const CLOSED_STATUSES = [
  "payment_collected",
  "customer_completed",
  "reviewed",
  "cancelled",
  "declined",
] as const;
