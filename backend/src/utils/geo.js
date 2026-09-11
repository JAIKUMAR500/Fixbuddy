export function km(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

export function etaMinutes(distanceKm, speedKmh = 22) {
  if (distanceKm == null) return null;
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
}

export function isOnline(lastSeenAt, ms = 120000) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ms;
}

export const BUSY_JOB_STATUSES = ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress"];
/** Worker is locked until payment is collected or the job is cancelled. */
export const LOCKED_JOB_STATUSES = [...BUSY_JOB_STATUSES, "completed"];
export const OPEN_JOB_STATUSES = ["matching", "open", "requested"];
export const PAID_JOB_STATUSES = ["payment_collected", "customer_completed", "reviewed"];
export const TRACKING_STATUSES = ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress"];
