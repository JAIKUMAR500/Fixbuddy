import { Server } from "socket.io";
import { Request } from "../models/Request.js";
import { resolveAccessToken } from "../middleware/auth.js";
import { isAllowedOrigin } from "../config/cors.js";
import { TRACKING_STATUSES, km } from "../utils/geo.js";
import {
  canJoinJobRoom,
  canJoinUserRoom,
  canPublishLocation,
  jobRoom,
  parseRoom,
  userRoom,
} from "./access.js";

const GPS_MIN_INTERVAL_MS = 2_000;
const lastGpsAt = new Map();
const seenEvents = new Map();
const SEEN_TTL_MS = 60_000;

let io = null;

function rememberEvent(eventId) {
  if (!eventId) return false;
  const now = Date.now();
  const prev = seenEvents.get(eventId);
  if (prev && now - prev < SEEN_TTL_MS) return true;
  seenEvents.set(eventId, now);
  if (seenEvents.size > 5_000) {
    for (const [key, at] of seenEvents) {
      if (now - at > SEEN_TTL_MS) seenEvents.delete(key);
    }
  }
  return false;
}

export function getIo() {
  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit(event, payload);
}

export function emitToJob(requestId, event, payload) {
  if (!io || !requestId) return;
  io.to(jobRoom(requestId)).emit(event, payload);
}

const STATUS_EVENT = {
  accepted: "job:accepted",
  on_the_way: "job:accepted",
  arrived: "worker:arrived",
  otp_verified: "job:otp_verified",
  in_progress: "job:started",
  completed: "job:completion_pending",
  customer_completed: "job:completed",
  payment_collected: "job:completed",
  cancelled: "job:cancelled",
};

export function emitJobStatusChange(doc) {
  if (!doc?._id) return;
  const requestId = String(doc._id);
  const payload = {
    requestId,
    jobId: requestId,
    status: doc.status,
    paymentStatus: doc.paymentStatus || "",
    at: Date.now(),
    eventId: `status:${requestId}:${doc.status}:${doc.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now()}`,
  };
  if (rememberEvent(payload.eventId)) return;
  emitToJob(requestId, "job:status_change", payload);
  emitToUser(doc.customerId, "job:status_change", payload);
  emitToUser(doc.providerId, "job:status_change", payload);
  for (const id of doc.crewMemberIds || []) emitToUser(id, "job:status_change", payload);
  const named = STATUS_EVENT[doc.status];
  if (named) {
    emitToJob(requestId, named, payload);
    emitToUser(doc.customerId, named, payload);
    emitToUser(doc.providerId, named, payload);
  }
}

export function emitLocationUpdate(doc) {
  if (!doc?._id) return;
  if (!TRACKING_STATUSES.includes(String(doc.status))) return;
  const requestId = String(doc._id);
  const at = doc.workerLocationAt ? new Date(doc.workerLocationAt).getTime() : Date.now();
  const payload = {
    requestId,
    jobId: requestId,
    workerId: doc.providerId ? String(doc.providerId) : null,
    lat: doc.workerLat,
    lng: doc.workerLng,
    latitude: doc.workerLat,
    longitude: doc.workerLng,
    timestamp: at,
    at,
    eventId: `loc:${requestId}:${at}`,
  };
  if (rememberEvent(payload.eventId)) return;
  emitToJob(requestId, "location:update", payload);
  emitToJob(requestId, "worker:location", payload);
  emitToUser(doc.customerId, "location:update", payload);
  emitToUser(doc.customerId, "worker:location", payload);
  emitToUser(doc.providerId, "location:update", payload);
}

export function emitChatMessage(conv, message) {
  if (!conv?.requestId || !message) return;
  const requestId = String(conv.requestId);
  const payload = {
    requestId,
    conversationId: String(conv._id),
    message,
    eventId: `chat:${message.id || message._id || Date.now()}`,
  };
  if (rememberEvent(payload.eventId)) return;
  emitToJob(requestId, "chat:message", payload);
  emitToUser(conv.customerId, "chat:message", payload);
  emitToUser(conv.providerId, "chat:message", payload);
}

export function attachRealtime(server) {
  io = new Server(server, {
    cors: {
      origin(origin, cb) {
        if (!origin || isAllowedOrigin(origin)) return cb(null, true);
        cb(new Error("Origin not allowed"));
      },
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    allowEIO3: false,
  });

  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.authorization || "";
      const fromAuth = socket.handshake.auth?.token;
      const token = (fromAuth && String(fromAuth)) || (header.startsWith("Bearer ") ? header.slice(7) : "");
      const cookieHeader = socket.handshake.headers.cookie || "";
      const resolved = await resolveAccessToken(token, cookieHeader);
      if (!resolved) return next(new Error("Sign in required"));
      if (resolved.user.status === "suspended") return next(new Error("Account suspended"));
      socket.data.user = resolved.user;
      socket.data.userId = String(resolved.user._id);
      socket.data.sessionId = String(resolved.session._id);
      next();
    } catch {
      next(new Error("Sign in required"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.data.userId));

    socket.on("job:join", async (body, ack) => {
      const requestId = String(body?.requestId || "");
      const job = await Request.findById(requestId).select("customerId providerId crewMemberIds status").lean();
      if (!canJoinJobRoom(socket.data.user, job)) {
        if (typeof ack === "function") ack({ ok: false, error: "Not allowed" });
        return;
      }
      socket.join(jobRoom(requestId));
      if (typeof ack === "function") ack({ ok: true, requestId });
    });

    socket.on("job:leave", (body) => {
      const requestId = String(body?.requestId || "");
      if (requestId) socket.leave(jobRoom(requestId));
    });

    socket.on("subscribe", async (body, ack) => {
      const parsed = parseRoom(body?.room);
      if (!parsed) {
        if (typeof ack === "function") ack({ ok: false, error: "Invalid room" });
        return;
      }
      if (parsed.kind === "user") {
        if (!canJoinUserRoom(socket.data.user, parsed.id)) {
          if (typeof ack === "function") ack({ ok: false, error: "Not allowed" });
          return;
        }
        socket.join(userRoom(parsed.id));
        if (typeof ack === "function") ack({ ok: true });
        return;
      }
      const job = await Request.findById(parsed.id).select("customerId providerId crewMemberIds status").lean();
      if (!canJoinJobRoom(socket.data.user, job)) {
        if (typeof ack === "function") ack({ ok: false, error: "Not allowed" });
        return;
      }
      socket.join(jobRoom(parsed.id));
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("location:update", async (body, ack) => {
      const requestId = String(body?.requestId || body?.jobId || "");
      const lat = Number(body?.lat ?? body?.latitude);
      const lng = Number(body?.lng ?? body?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        if (typeof ack === "function") ack({ ok: false, error: "lat and lng are required" });
        return;
      }
      const throttleKey = `${socket.data.userId}:${requestId}`;
      const prev = lastGpsAt.get(throttleKey) || 0;
      if (Date.now() - prev < GPS_MIN_INTERVAL_MS) {
        if (typeof ack === "function") ack({ ok: false, error: "Too frequent" });
        return;
      }
      const job = await Request.findById(requestId);
      if (!canPublishLocation(socket.data.user, job)) {
        if (typeof ack === "function") ack({ ok: false, error: "Location updates are only during an active job." });
        return;
      }
      lastGpsAt.set(throttleKey, Date.now());
      const prevAt = job.workerLocationAt ? new Date(job.workerLocationAt).getTime() : 0;
      const movedKm = km(job.workerLat, job.workerLng, lat, lng);
      const persist = !prevAt || Date.now() - prevAt >= 20_000 || (movedKm != null && movedKm * 1000 >= 25);
      job.workerLat = lat;
      job.workerLng = lng;
      job.workerLocationAt = new Date();
      if (persist) await job.save();
      emitLocationUpdate(job);
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("disconnect", () => {
      /* Rooms are dropped automatically. */
    });
  });

  return io;
}

export function closeRealtime() {
  if (!io) return Promise.resolve();
  const current = io;
  io = null;
  return new Promise((resolve) => current.close(() => resolve()));
}
