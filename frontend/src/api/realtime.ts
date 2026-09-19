import { io, type Socket } from "socket.io-client";
import { BASE } from "./client";

export type RealtimeEvent =
  | "location:update"
  | "chat:message"
  | "job:status_change"
  | "job:accepted"
  | "worker:arrived"
  | "job:otp_verified"
  | "job:started"
  | "job:completion_pending"
  | "job:completed"
  | "job:cancelled";

export type RealtimeConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

type Handler = (payload: Record<string, unknown>) => void;

const listeners = new Map<RealtimeEvent, Set<Handler>>();
const connectionListeners = new Set<(state: RealtimeConnectionState) => void>();
const seen = new Set<string>();
let socket: Socket | null = null;
let connected = false;
let connectionState: RealtimeConnectionState = "disconnected";
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

function setConnectionState(next: RealtimeConnectionState) {
  connectionState = next;
  connected = next === "connected";
  connectionListeners.forEach((handler) => handler(next));
}

function dispatch(event: RealtimeEvent, payload: Record<string, unknown>) {
  if (remember(payload.eventId)) return;
  listeners.get(event)?.forEach((handler) => handler(payload));
}

export function isRealtimeConnected() {
  return connected && Boolean(socket?.connected);
}

export function getRealtimeConnectionState() {
  return connectionState;
}

export function subscribeConnection(handler: (state: RealtimeConnectionState) => void) {
  connectionListeners.add(handler);
  handler(connectionState);
  return () => {
    connectionListeners.delete(handler);
  };
}

const SOCKET_EVENTS: RealtimeEvent[] = [
  "location:update",
  "chat:message",
  "job:status_change",
  "job:accepted",
  "worker:arrived",
  "job:otp_verified",
  "job:started",
  "job:completion_pending",
  "job:completed",
  "job:cancelled",
];

export function connectRealtime(token?: string) {
  if (socket) return socket;
  setConnectionState("connecting");
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
    setConnectionState("connected");
    if (joinedJobId) socket?.emit("job:join", { requestId: joinedJobId });
  });
  socket.on("disconnect", () => {
    setConnectionState("disconnected");
  });
  socket.io.on("reconnect_attempt", () => {
    setConnectionState("reconnecting");
  });
  socket.on("connect_error", () => {
    setConnectionState(socket?.active ? "reconnecting" : "disconnected");
  });
  SOCKET_EVENTS.forEach((event) => {
    socket?.on(event, (payload: Record<string, unknown>) => dispatch(event, payload || {}));
  });
  socket.on("worker:location", (payload: Record<string, unknown>) => {
    dispatch("location:update", payload || {});
  });
  return socket;
}

export function joinRealtimeJob(requestId?: string | null) {
  const id = String(requestId || "");
  if (!socket) {
    joinedJobId = id;
    return;
  }
  if (joinedJobId && joinedJobId !== id) {
    socket.emit("job:leave", { requestId: joinedJobId });
  }
  joinedJobId = id;
  if (id) socket.emit("job:join", { requestId: id });
}

export function publishWorkerLocation(requestId: string, lat: number, lng: number) {
  if (!socket?.connected || !requestId) return false;
  socket.emit("location:update", {
    requestId,
    jobId: requestId,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    timestamp: Date.now(),
  });
  return true;
}

export function disconnectRealtime() {
  joinedJobId = "";
  setConnectionState("disconnected");
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
