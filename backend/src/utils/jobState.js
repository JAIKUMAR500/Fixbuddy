import { httpError } from "./asyncHandler.js";

/**
 * Canonical FixBuddy job statuses. Public copy maps:
 * EN_ROUTE = on_the_way, COMPLETION_PENDING = completed (awaiting customer confirm).
 */
export const ALLOWED_TRANSITIONS = {
  matching: ["open", "requested", "cancelled"],
  open: ["matching", "requested", "accepted", "cancelled"],
  requested: ["open", "matching", "accepted", "cancelled"],
  accepted: ["on_the_way", "scheduled", "arrived", "cancelled", "open"],
  scheduled: ["on_the_way", "accepted", "arrived", "cancelled"],
  on_the_way: ["arrived", "cancelled", "open"],
  arrived: ["otp_verified", "in_progress", "cancelled"],
  otp_verified: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["payment_collected", "customer_completed", "cancelled"],
  payment_collected: ["customer_completed", "reviewed"],
  customer_completed: ["reviewed"],
  reviewed: [],
  cancelled: [],
  declined: [],
};

export function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (canTransition(from, to)) return;
  throw httpError(409, `This job cannot move from ${from} to ${to}.`);
}

export function coordsFromBody(body) {
  if (!body || typeof body !== "object") return null;
  const lat = Number(body.lat ?? body.latitude);
  const lng = Number(body.lng ?? body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function applyWorkerCoords(doc, body) {
  const coords = coordsFromBody(body);
  if (!coords) return false;
  doc.workerLat = coords.lat;
  doc.workerLng = coords.lng;
  doc.workerLocationAt = new Date();
  return true;
}
