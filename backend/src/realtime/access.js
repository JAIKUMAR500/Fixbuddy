import { isAdmin } from "../utils/roles.js";
import { TRACKING_STATUSES } from "../utils/geo.js";

const USER_ROOM = /^user:([a-f0-9]{24})$/i;
const JOB_ROOM = /^job:([a-f0-9]{24})$/i;

export function userRoom(userId) {
  return `user:${String(userId)}`;
}

export function jobRoom(requestId) {
  return `job:${String(requestId)}`;
}

export function parseRoom(room) {
  const value = String(room || "").trim();
  const user = value.match(USER_ROOM);
  if (user) return { kind: "user", id: user[1] };
  const job = value.match(JOB_ROOM);
  if (job) return { kind: "job", id: job[1] };
  return null;
}

/** Only the account owner (or admin) may sit in user:{id}. */
export function canJoinUserRoom(user, userId) {
  if (!user || !userId) return false;
  if (isAdmin(user.role)) return true;
  return String(user._id) === String(userId);
}

/** Assigned participants only. Unassigned workers cannot subscribe. */
export function canJoinJobRoom(user, job) {
  if (!user || !job) return false;
  if (isAdmin(user.role)) return true;
  if (String(job.customerId) === String(user._id)) return true;
  if (job.providerId && String(job.providerId) === String(user._id)) return true;
  if ((job.crewMemberIds || []).some((id) => String(id) === String(user._id))) return true;
  return false;
}

export function canPublishLocation(user, job) {
  if (!canJoinJobRoom(user, job)) return false;
  if (!TRACKING_STATUSES.includes(String(job.status))) return false;
  const isAssignedWorker = Boolean(job.providerId) && String(job.providerId) === String(user._id);
  const isCrew = (job.crewMemberIds || []).some((id) => String(id) === String(user._id));
  return isAssignedWorker || isCrew || isAdmin(user.role);
}

export { TRACKING_STATUSES };
