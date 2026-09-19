import { io, type Socket } from "socket.io-client";
import { BASE } from "./client";

export type RealtimeEvent = "location:update" | "chat:message" | "job:status_change";

type Handler = (payload: Record<string, unknown>) => void;

const listeners = new Map<RealtimeEvent, Set<Handler>>();
const seen = new Set<string>();
let socket: Socket | null = null;
let connected = false;
let joinedJobId = "";

function originForSocket() {
  if (BASE.startsWith("http")) {
    return BASE.replace(/\/api\/?$/, "");
  }
  return window.location.origin;
}

function remember(eventId: unknown) {
  const id = String(eventId || "");
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 400) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return false;
}

function dispatch(event: RealtimeEvent, payload: Record<string, unknown>) {
  if (remember(payload.eventId)) return;
  listeners.get(event)?.forEach((handler) => handler(payload));
}

export function isRealtimeConnected() {
  return connected && Boolean(socket?.connected);
}

export function connectRealtime(token?: string) {
  if (socket) return socket;
  socket = io(originForSocket(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionAttempts: Infinity,
  });
  socket.on("connect", () => {
    connected = true;
    if (joinedJobId) socket?.emit("job:join", { requestId: joinedJobId });
  });
  socket.on("disconnect", () => {
    connected = false;
  });
  socket.on("connect_error", () => {
    connected = false;
  });
  (["location:update", "chat:message", "job:status_change"] as RealtimeEvent[]).forEach((event) => {
    socket?.on(event, (payload: Record<string, unknown>) => dispatch(event, payload || {}));
  });
  return socket;
}

export function joinRealtimeJob(requestId?: string | null) {
  const id = String(requestId || "");
  if (!socket || !id || joinedJobId === id) {
    joinedJobId = id || joinedJobId;
    return;
  }
  if (joinedJobId) socket.emit("job:leave", { requestId: joinedJobId });
  joinedJobId = id;
  socket.emit("job:join", { requestId: id });
}

export function disconnectRealtime() {
  joinedJobId = "";
  connected = false;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function subscribeRealtime(event: RealtimeEvent, handler: Handler) {
  const set = listeners.get(event) || new Set<Handler>();
  set.add(handler);
  listeners.set(event, set);
  return () => {
    set.delete(handler);
  };
}
