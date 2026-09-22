import { Capacitor } from "@capacitor/core";

/** Live Express API on Render. Used when VITE_API_URL is empty outside local Vite. */
const PRODUCTION_API = "https://fixbuddy-1-nh5a.onrender.com";

function apiBase() {
  const raw = String(import.meta.env.VITE_API_URL || "").trim();
  if (!raw) {
    if (Capacitor.isNativePlatform()) return `${PRODUCTION_API.replace(/\/$/, "")}/api`;
    // Production Vercel builds have no Vite proxy — /api would return index.html.
    if (import.meta.env.PROD) return `${PRODUCTION_API.replace(/\/$/, "")}/api`;
    return "/api";
  }
  const noSlash = raw.replace(/\/$/, "");
  return noSlash.endsWith("/api") ? noSlash : `${noSlash}/api`;
}

export const BASE = apiBase();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiOpts = RequestInit & { skipAuthRefresh?: boolean };

function keepBearerToken() {
  // Cross-origin API (native, VITE_API_URL, or production CDN → Render) needs Bearer tokens.
  return (
    Capacitor.isNativePlatform() ||
    Boolean(String(import.meta.env.VITE_API_URL || "").trim()) ||
    Boolean(import.meta.env.PROD)
  );
}

export function persistSession(token?: string, refreshToken?: string) {
  localStorage.setItem("fb_session", "1");
  if (keepBearerToken() && token) localStorage.setItem("fb_token", token);
  else if (!keepBearerToken()) localStorage.removeItem("fb_token");
  if (keepBearerToken() && refreshToken) localStorage.setItem("fb_refresh", refreshToken);
  else localStorage.removeItem("fb_refresh");
}

export function clearSession() {
  localStorage.removeItem("fb_token");
  localStorage.removeItem("fb_refresh");
  localStorage.removeItem("fb_session");
}

export function hasSessionHint() {
  return Boolean(localStorage.getItem("fb_token") || localStorage.getItem("fb_session"));
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = localStorage.getItem("fb_refresh") || "";
      const data = await api<{ token?: string; refreshToken?: string }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        skipAuthRefresh: true,
      });
      persistSession(data.token, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function api<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const token = localStorage.getItem("fb_token");
  const headers: Record<string, string> = {
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((opts.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const skipExpire =
      path.startsWith("/auth/login") ||
      path.startsWith("/auth/signup") ||
      path.startsWith("/auth/google") ||
      path.startsWith("/auth/forgot") ||
      path.startsWith("/auth/reset") ||
      path.startsWith("/auth/logout") ||
      path.startsWith("/auth/refresh");
    if (res.status === 401 && !skipExpire && !opts.skipAuthRefresh && hasSessionHint()) {
      const recovered = await tryRefreshSession();
      if (recovered) return api<T>(path, { ...opts, skipAuthRefresh: true });
      clearSession();
      window.dispatchEvent(new Event("fixbuddy:unauthorized"));
    }
    throw new ApiError(res.status, data.message || "Request failed");
  }
  return data as T;
}

export const AuthAPI = {
  login: (email: string, password: string, role?: string) =>
    api<{ token: string; refreshToken?: string; user: AppUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, role }) }),
  signup: (body: object) =>
    api<{ token: string; refreshToken?: string; user: AppUser }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
  logoutAll: () => api<void>("/auth/logout-all", { method: "POST" }),
  google: (credential: string, role?: string) =>
    api<{ token: string; refreshToken?: string; user: AppUser }>("/auth/google", { method: "POST", body: JSON.stringify({ credential, role }) }),
  forgot: (email: string, role?: string) =>
    api<{ ok: boolean; message: string; otp?: string; queued?: boolean }>("/auth/forgot", { method: "POST", body: JSON.stringify({ email, role }) }),
  reset: (body: { email: string; otp: string; password: string; role?: string }) =>
    api<{ token: string; refreshToken?: string; user: AppUser }>("/auth/reset", { method: "POST", body: JSON.stringify(body) }),
  refresh: () =>
    api<{ token: string; refreshToken?: string; user: AppUser }>("/auth/refresh", { method: "POST", body: JSON.stringify({}), skipAuthRefresh: true }),
  me: () => api<{ user: AppUser }>("/auth/me"),
  updateMe: (body: object) => api<{ user: AppUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

function compressDataUrl(dataUrl: string, max = 1600, quality = 0.82) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(1, max / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not read that image. Use JPG, PNG, or WebP."));
    img.src = dataUrl;
  });
}

function isHeic(file: File) {
  const n = (file.name || "").toLowerCase();
  const t = (file.type || "").toLowerCase();
  return t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif");
}

function looksLikeImage(file: File) {
  const n = (file.name || "").toLowerCase();
  if (n.endsWith(".svg") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(n)) return true;
  return (file.type || "").startsWith("image/");
}

export async function uploadImage(file: File) {
  if (isHeic(file)) {
    throw new Error("iPhone HEIC photos are not supported. In Photos, export as JPG, then upload.");
  }
  if (!looksLikeImage(file)) {
    throw new Error("Please choose a JPG, PNG, WebP, or SVG file.");
  }
  const raw = await readFileAsDataUrl(file);
  const dataUrl =
    file.type === "image/svg+xml" || (file.name || "").toLowerCase().endsWith(".svg") ? raw : await compressDataUrl(raw);
  return api<{ url: string; kind?: string }>("/upload", { method: "POST", body: JSON.stringify({ dataUrl, filename: file.name }) });
}

export function mediaUrl(url?: string | null) {
  if (!url) return "";
  const raw = String(url).trim();
  if (/^(data:|blob:)/i.test(raw)) return raw;
  const apiOrigin = BASE.replace(/\/api\/?$/, "");
  const withoutLocal = raw.replace(/^https?:\/\/(localhost|127\.0\.0\.1):\d+/i, "");
  if (withoutLocal.startsWith("/")) return `${apiOrigin}${withoutLocal}`;
  if (raw.startsWith("/")) return `${apiOrigin}${raw}`;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith("/api/uploads")) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    /* keep original */
  }
  return raw;
}

export async function uploadRemoteUrl(url: string) {
  return api<{ url: string; kind?: string }>("/upload", { method: "POST", body: JSON.stringify({ url }) });
}

export async function uploadDataUrl(dataUrl: string, filename = "photo.png") {
  return api<{ url: string; kind?: string }>("/upload", { method: "POST", body: JSON.stringify({ dataUrl, filename }) });
}

export function supportedRecordingMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
}

export function recordingExtension(mime: string) {
  return mime.startsWith("audio/mp4") ? "m4a" : mime.startsWith("audio/ogg") ? "ogg" : "webm";
}

export async function uploadMedia(file: File) {
  const isAudio = file.type.startsWith("audio/");
  if (isHeic(file)) {
    throw new Error("iPhone HEIC photos are not supported. Export as JPG, then send.");
  }
  if (!isAudio && file.type && !file.type.startsWith("image/") && !looksLikeImage(file)) {
    throw new Error("Please choose a photo or a voice recording.");
  }
  const dataUrl = isAudio ? await readFileAsDataUrl(file) : await compressDataUrl(await readFileAsDataUrl(file));
  return api<{ url: string; kind?: string }>("/upload", { method: "POST", body: JSON.stringify({ dataUrl, filename: file.name }) });
}

export const RequestAPI = {
  create: (body: object) => api<{ request: JobRequest }>("/requests", { method: "POST", body: JSON.stringify(body) }),
  list: (q = "") => api<{ requests: JobRequest[] }>(`/requests${q}`),
  get: (id: string, matches = false) =>
    api<{ request: JobRequest }>(`/requests/${id}${matches ? "?matches=true" : ""}`),
  assign: (id: string, providerId: string) =>
    api<{ request: JobRequest }>(`/requests/${id}/assign`, { method: "POST", body: JSON.stringify({ providerId }) }),
  accept: (id: string, body?: object) =>
    api<{ request: JobRequest }>(`/requests/${id}/accept`, { method: "POST", body: JSON.stringify(body || {}) }),
  decline: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/decline`, { method: "POST" }),
  schedule: (id: string, body: object) =>
    api<{ request: JobRequest }>(`/requests/${id}/schedule`, { method: "POST", body: JSON.stringify(body) }),
  start: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/start`, { method: "POST" }),
  complete: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/complete`, { method: "POST" }),
  cancel: (id: string, body?: object) =>
    api<{ request: JobRequest; compensation?: number; eligible?: boolean }>(`/requests/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    }),
  review: (id: string, body: object) =>
    api<{ request: JobRequest }>(`/requests/${id}/review`, { method: "POST", body: JSON.stringify(body) }),
  quote: (id: string, amount: number) =>
    api<{ request: JobRequest }>(`/requests/${id}/quote`, { method: "POST", body: JSON.stringify({ amount }) }),
  enroute: (id: string, body?: object) =>
    api<{ request: JobRequest }>(`/requests/${id}/enroute`, { method: "POST", body: JSON.stringify(body || {}) }),
  arrive: (id: string, body?: object) =>
    api<{ request: JobRequest }>(`/requests/${id}/arrive`, { method: "POST", body: JSON.stringify(body || {}) }),
  verifyOtp: (id: string, otp: string) =>
    api<{ request: JobRequest }>(`/requests/${id}/verify-otp`, { method: "POST", body: JSON.stringify({ otp }) }),
  pingLocation: (id: string, lat: number, lng: number) =>
    api<{ request: JobRequest }>(`/requests/${id}/location`, { method: "PATCH", body: JSON.stringify({ lat, lng }) }),
  tracking: (id: string) =>
    api<{
      requestId: string;
      jobId: string;
      status: string;
      tracking: boolean;
      workerId: string | null;
      latitude: number | null;
      longitude: number | null;
      timestamp: string | null;
      customerLat: number | null;
      customerLng: number | null;
      distanceKm: number | null;
      etaMinutes: number | null;
    }>(`/requests/${id}/tracking`),
  collectPayment: (id: string) =>
    api<{ request: JobRequest }>(`/requests/${id}/collect-payment`, { method: "POST" }),
  customerComplete: (id: string) =>
    api<{ request: JobRequest }>(`/requests/${id}/customer-complete`, { method: "POST" }),
  active: () => api<{ request: JobRequest | null }>("/requests/active"),
  currentJob: () => api<{ request: JobRequest | null; locked?: boolean }>("/requests/current-job"),
  watchLink: (id: string) =>
    api<{ token: string; expiresAt: string; path: string }>(`/requests/${id}/watch-link`, { method: "POST" }),
  revokeWatch: (id: string) => api<{ ok: boolean }>(`/requests/${id}/watch-link`, { method: "DELETE" }),
  workPhotos: (id: string, stage: "before" | "during" | "after", url: string, caption = "") =>
    api<{ request: JobRequest }>(`/requests/${id}/work-photos`, {
      method: "POST",
      body: JSON.stringify({ stage, url, caption }),
    }),
  delay: (id: string, reason: string, note = "") =>
    api<{ request: JobRequest }>(`/requests/${id}/delay`, { method: "POST", body: JSON.stringify({ reason, note }) }),
  priceBand: (q: string) =>
    api<{ min: number | null; max: number | null; typical?: number; text: string; sample: number }>(`/requests/price-band${q}`),
  requestPriceChange: (id: string, body: { requestedAmount?: number; additionalAmount?: number; reason: string }) =>
    api<{ request: JobRequest }>(`/requests/${id}/price-change`, { method: "POST", body: JSON.stringify(body) }),
  respondPriceChange: (
    id: string,
    changeId: string,
    payload: { action: "approve" | "reject"; customerNote?: string } | "approve" | "reject",
    note?: string
  ) => {
    const body = typeof payload === "string" ? { action: payload, customerNote: note } : payload;
    return api<{ request: JobRequest }>(`/requests/${id}/price-change/${changeId}/respond`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  requestMaterial: (
    id: string,
    body:
      | { itemName: string; estimatedCost: number; receiptPhoto?: string }
      | { item: string; quantity: number; estimatedPrice: number; reason: string }
  ) => api<{ request: JobRequest }>(`/requests/${id}/material-request`, { method: "POST", body: JSON.stringify(body) }),
  respondMaterial: (
    id: string,
    materialId: string,
    payload: { action: "approve" | "reject"; customerNote?: string } | "approve" | "reject"
  ) => {
    const body = typeof payload === "string" ? { action: payload } : payload;
    return api<{ request: JobRequest }>(`/requests/${id}/material-request/${materialId}/respond`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  handover: (id: string, payload: { reason: string; note?: string } | string) => {
    const body = typeof payload === "string" ? { reason: payload } : payload;
    return api<{ ok: boolean; request: JobRequest }>(`/requests/${id}/handover`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  reportNoShow: (id: string, body: { reason?: string; action?: "rematch" | "cancel" }) =>
    api<{ ok: boolean; request: JobRequest }>(`/requests/${id}/report-no-show`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  customerUnavailable: (id: string, payload?: { note?: string } | string) => {
    const body = typeof payload === "string" ? { reason: payload } : payload || {};
    return api<{ ok: boolean; request: JobRequest }>(`/requests/${id}/customer-unavailable`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  confirmBill: (id: string) =>
    api<{ ok: boolean; request: JobRequest }>(`/requests/${id}/confirm-bill`, { method: "POST" }),
  requestReschedule: (
    id: string,
    body: { requestedDate?: string; proposedAt?: string; proposedLabel?: string; reason?: string }
  ) =>
    api<{ ok: boolean; request: JobRequest }>(`/requests/${id}/reschedule-request`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  respondReschedule: (id: string, payload: { action: "accept" | "reject" } | "accept" | "reject") => {
    const body = typeof payload === "string" ? { action: payload } : payload;
    return api<{ ok: boolean; request: JobRequest }>(`/requests/${id}/reschedule-respond`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export const ChatAPI = {
  list: () => api<{ conversations: ChatThread[] }>("/conversations"),
  open: (requestId: string, providerId?: string) =>
    api<{ conversationId: string; requestId: string }>("/conversations/open", { method: "POST", body: JSON.stringify({ requestId, providerId }) }),
  messages: (id: string) => api<{ conversationId: string; requestId: string; messages: ChatMsg[] }>(`/conversations/${id}/messages`),
  send: (id: string, body: { text?: string; kind?: string; mediaUrl?: string; durationSec?: number }) =>
    api<{ message: ChatMsg }>(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(body) }),
  deleteMessage: (conversationId: string, messageId: string, scope: "me" | "everyone") =>
    api<{ ok: boolean }>(`/conversations/${conversationId}/messages/${messageId}/delete`, {
      method: "POST",
      body: JSON.stringify({ scope }),
    }),
};

export const NotifAPI = {
  list: () => api<{ unread: number; notifications: AppNotif[] }>("/notifications"),
  read: (ids?: string[]) => api("/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }),
  preferences: () => api<{ preferences: Record<string, boolean> }>("/notifications/preferences"),
  savePreferences: (body: object) => api<{ preferences: Record<string, boolean> }>("/notifications/preferences", { method: "PATCH", body: JSON.stringify(body) }),
};

export const ReviewAPI = {
  list: (providerId?: string) => api<ReviewsPayload>(`/reviews${providerId ? `?providerId=${providerId}` : ""}`),
};

export const ProviderAPI = {
  list: (q = "") => api<{ providers: Provider[] }>(`/providers${q}`),
  get: (id: string) => api<{ provider: Provider }>(`/providers/${id}`),
  onboard: (body: object) => api<{ user: AppUser }>("/providers/onboarding", { method: "POST", body: JSON.stringify(body) }),
  update: (body: object) => api<{ user: AppUser }>("/providers/profile", { method: "PATCH", body: JSON.stringify(body) }),
};

export const CategoryAPI = {
  list: () => api<{ categories: ServiceCategory[] }>("/categories"),
  all: () => api<{ categories: ServiceCategory[] }>("/categories/all"),
  create: (body: object) => api<{ category: ServiceCategory }>("/categories", { method: "POST", body: JSON.stringify(body) }),
  patch: (id: string, body: object) =>
    api<{ category: ServiceCategory }>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export const TeamAPI = {
  get: () =>
    api<{
      team: TeamPayload | null;
      memberships?: {
        teamId: string;
        ownerId?: string;
        businessName?: string;
        member: { id: string; status: string; role?: string; name: string } | null;
      }[];
    }>("/team"),
  searchWorkers: (q: string) =>
    api<{ workers: { id: string; name: string; userCode: string; category: string; verified: boolean; ratingAvg: number; avatar?: string }[] }>(
      `/team/search-workers?q=${encodeURIComponent(q)}`
    ),
  addGroup: (name: string) => api<{ team: TeamPayload }>("/team/groups", { method: "POST", body: JSON.stringify({ name }) }),
  patchGroup: (id: string, body: object) => api<{ team: TeamPayload }>(`/team/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeGroup: (id: string) => api<{ team: TeamPayload }>(`/team/groups/${id}`, { method: "DELETE" }),
  addMember: (body: object) => api<{ team: TeamPayload }>("/team/members", { method: "POST", body: JSON.stringify(body) }),
  invite: (userId: string, role = "worker") =>
    api<{ team: TeamPayload }>("/team/invite", { method: "POST", body: JSON.stringify({ userId, role }) }),
  acceptInvite: (memberId: string) =>
    api<{ team: TeamPayload }>(`/team/invitations/${memberId}/accept`, { method: "POST" }),
  rejectInvite: (memberId: string) =>
    api<{ ok: boolean }>(`/team/invitations/${memberId}/reject`, { method: "POST" }),
  patchMember: (id: string, body: object) => api<{ team: TeamPayload }>(`/team/members/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeMember: (id: string) => api<{ team: TeamPayload }>(`/team/members/${id}`, { method: "DELETE" }),
  leave: (teamId?: string) =>
    api<{ ok: boolean; left: boolean }>("/team/leave", { method: "POST", body: JSON.stringify({ teamId }) }),
  assignJob: (requestId: string, workerId: string) =>
    api<{ ok: boolean; request: JobRequest }>("/team/assign-job", {
      method: "POST",
      body: JSON.stringify({ requestId, workerId }),
    }),
};

export type WorkerJobCard = {
  id: string;
  code?: string;
  category: string;
  description?: string;
  amount: number;
  area?: string;
  city?: string;
  timing?: string;
  distanceKm: number | null;
  etaMinutes: number | null;
  durationHours?: number;
  urgent?: boolean;
  status?: string;
  workersRequired?: number;
  onWayHome?: boolean;
  homeKm?: number | null;
};

// Alias kept for callers that used the older WorkerJobSuggestion name.
export type WorkerJobSuggestion = WorkerJobCard;

export type WorkerTarget = {
  date: string;
  amount: number;
  earned: number;
  remaining: number;
  percent: number;
  achieved: boolean;
  jobsCompleted?: number;
};

export type WorkerBadge = { id: string; label: string; icon: string };

export type WorkerCrew = {
  id: string;
  name: string;
  description: string;
  skills: string[];
  serviceArea: string;
  maxMembers: number;
  leaderId: string;
  leader?: { name: string; category?: string; userId?: string };
  members: {
    id: string;
    userId: string;
    role: string;
    status: string;
    sharePercent: number;
    name: string;
    avatar?: string;
    category?: string;
    verified?: boolean;
    ratingAvg?: number;
    userCode?: string;
  }[];
  activeCount: number;
  splitMode: string;
  status: string;
  completedJobs: number;
  ratingAvg: number;
  ratingCount: number;
  verified?: boolean;
};

export type WorkerPassport = {
  userCode: string;
  name: string;
  avatar?: string;
  category: string;
  experience: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  onTimePct: number;
  cancelPct: number;
  city?: string;
  area?: string;
  serviceAreas?: string[];
  languages?: string[];
  bio?: string;
  skills: { id?: string; name: string; verified: boolean; pending: boolean }[];
  badges: WorkerBadge[];
  stats?: WorkerPassportStats;
  byCategory?: Record<string, { jobs: number; amount: number }>;
  proof?: { category: string; before: string; after: string }[];
  publicProfileUrl?: string;
};

export type WorkerPassportStats = {
  jobs: number;
  completed: number;
  ratingAvg: number;
  ratingCount: number;
  onTimePct: number;
  cancelPct: number;
  byCategory: Record<string, { jobs: number; amount: number }>;
  verified: boolean;
};

export const WorkerAPI = {
  dashboard: () =>
    api<{
      greeting: string;
      available: boolean;
      nextJobAvailable: boolean;
      todayJobs: number;
      locked?: boolean;
      activeJob?: { id: string; code: string; category: string; status: string; area?: string } | null;
      target: WorkerTarget;
      bestJob: WorkerJobCard | null;
      nearbyCount: number;
      recommended: WorkerJobCard[];
      crew: { id: string; name: string; members: number; ratingAvg: number; completedJobs: number } | null;
      passport: { verified: boolean; jobs: number; ratingAvg: number; badges: WorkerBadge[] };
      festival?: { name: string; city: string; note: string } | null;
      hasSkills?: boolean;
      skills?: string[];
    }>("/worker/dashboard"),
  getTarget: () => api<{ target: WorkerTarget }>("/worker/daily-target"),
  setTarget: (amount: number) =>
    api<{ target: WorkerTarget }>("/worker/daily-target", { method: "PUT", body: JSON.stringify({ amount }) }),
  // Alias kept for callers that used the older saveTarget name.
  saveTarget: (amount: number) =>
    api<{ target: WorkerTarget }>("/worker/daily-target", { method: "PUT", body: JSON.stringify({ amount }) }),
  history: () =>
    api<{ history: Record<string, { amount: number; jobs: number }> }>("/worker/earnings/history"),
  nearby: (sort = "recommended") =>
    api<{
      jobs: WorkerJobCard[];
      remaining: number;
      gps: boolean;
      nextJobAvailable: boolean;
      message?: string;
      locked?: boolean;
      activeJobId?: string;
      hasSkills?: boolean;
      skills?: string[];
    }>(`/worker/nearby-jobs?sort=${encodeURIComponent(sort)}`),
  recommended: () =>
    api<{ best: WorkerJobCard | null; jobs: WorkerJobCard[]; remaining: number; target: number; earned: number }>(
      "/worker/recommended-jobs"
    ),
  availability: (body: { available?: boolean; nextJobAvailable?: boolean }) =>
    api<{ available: boolean; nextJobAvailable: boolean }>("/worker/availability", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  passport: () => api<{ passport: WorkerPassport }>("/worker/passport"),
  updatePassport: (body: object) =>
    api<{ passport: WorkerPassport }>("/worker/passport", { method: "PUT", body: JSON.stringify(body) }),
  // Alias kept for callers that used the older savePassport name.
  savePassport: (body: object) =>
    api<{ passport: WorkerPassport }>("/worker/passport", { method: "PUT", body: JSON.stringify(body) }),
  safety: (body: object) =>
    api<{ incident: { id: string; type: string; status: string } }>("/safety/incidents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addSkill: (name: string) =>
    api<{ skills: WorkerPassport["skills"] }>("/worker/skills", { method: "POST", body: JSON.stringify({ name }) }),
  requestVerify: (id: string) =>
    api<{ skill: { id: string; name: string; verified: boolean; pending: boolean } }>(`/worker/skills/${id}/verify`, {
      method: "POST",
    }),
  badges: () => api<{ badges: WorkerBadge[] }>("/worker/badges"),
  idleStatus: () =>
    api<{
      idle: boolean;
      minutes: number;
      estimateInr: number;
      message: string;
      nextJob: WorkerJobCard | null;
    }>("/worker/idle-status"),
  demandHeatmap: (params?: { category?: string; priority?: string; maxDistanceKm?: number; lat?: number; lng?: number }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.priority) q.set("priority", params.priority);
    if (params?.maxDistanceKm) q.set("maxDistanceKm", String(params.maxDistanceKm));
    if (params?.lat != null) q.set("lat", String(params.lat));
    if (params?.lng != null) q.set("lng", String(params.lng));
    const qs = q.toString();
    return api<{ workerLocation?: { lat: number; lng: number }; totalJobs?: number; totalActiveDemands?: number; clusters: JobDemandCluster[] }>(
      `/worker/job-demand-heatmap${qs ? `?${qs}` : ""}`
    );
  },
  reliabilityProfile: (workerId?: string) =>
    api<WorkerReliability>(`/worker/reliability-profile${workerId ? `?workerId=${workerId}` : ""}`),
  getNotificationPreferences: () =>
    api<{ preferences: WorkerJobAlertPreferences }>("/worker/notification-preferences"),
  updateNotificationPreferences: (preferences: Partial<WorkerJobAlertPreferences>) =>
    api<{ ok: boolean; preferences: WorkerJobAlertPreferences }>("/worker/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    }),
};

export const CrewAPI = {
  mine: () => api<{ crews: WorkerCrew[] }>("/crews"),
  browse: (q = "") => api<{ crews: WorkerCrew[] }>(`/crews?browse=true${q}`),
  get: (id: string) => api<{ crew: WorkerCrew }>(`/crews/${id}`),
  create: (body: object) => api<{ crew: WorkerCrew }>("/crews", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) => api<{ crew: WorkerCrew }>(`/crews/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  searchWorkers: (q: string) =>
    api<{ workers: { id: string; name: string; userCode: string; category: string; verified: boolean; ratingAvg: number }[] }>(
      `/crews/search-workers?q=${encodeURIComponent(q)}`
    ),
  invite: (id: string, userId: string) =>
    api<{ crew: WorkerCrew }>(`/crews/${id}/invite`, { method: "POST", body: JSON.stringify({ userId }) }),
  acceptInvite: (id: string, invitationId: string) =>
    api<{ crew: WorkerCrew }>(`/crews/${id}/invitations/${invitationId}/accept`, { method: "POST" }),
  rejectInvite: (id: string, invitationId: string) =>
    api<{ crew: WorkerCrew }>(`/crews/${id}/invitations/${invitationId}/reject`, { method: "POST" }),
  removeMember: (id: string, memberId: string) => api<{ crew: WorkerCrew }>(`/crews/${id}/members/${memberId}`, { method: "DELETE" }),
  leave: (id: string) => api<{ crew: WorkerCrew; left: boolean }>(`/crews/${id}/leave`, { method: "POST" }),
  transferLead: (id: string, userId: string) =>
    api<{ crew: WorkerCrew }>(`/crews/${id}/transfer-lead`, { method: "POST", body: JSON.stringify({ userId }) }),
  dissolve: (id: string) => api<{ ok: boolean; dissolved: boolean; crew: WorkerCrew }>(`/crews/${id}/dissolve`, { method: "POST" }),
  requestJob: (crewId: string, requestId: string, workersRequired?: number) =>
    api<{ ok: boolean }>(`/crews/${crewId}/jobs`, { method: "POST", body: JSON.stringify({ requestId, workersRequired }) }),
  acceptJob: (crewId: string, jobId: string, memberIds: string[], reject = false) =>
    api<{ ok: boolean }>(`/crews/${crewId}/jobs/${jobId}/accept`, {
      method: "POST",
      body: JSON.stringify({ memberIds, reject }),
    }),
  preview: (id: string, amount: number) =>
    api<{ split: { gross: number; fee: number; net: number; commissionPercent: number; shares: { userId: string; role: string; amount: number }[] } }>(
      `/crews/${id}/earnings-preview?amount=${amount}`
    ),
};

export const SafetyAPI = {
  create: (body: object) =>
    api<{ incident: { id: string; type: string; status: string } }>("/safety/incidents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  list: () => api<{ incidents: { id: string; type: string; status: string; description?: string; createdAt: string }[] }>("/safety/incidents"),
  report: (body: object) => api<{ ok: boolean }>("/safety/report", { method: "POST", body: JSON.stringify(body) }),
  reportDispute: (body: { requestId: string; reason: string; description?: string; body?: string; subject?: string; photos?: string[] }) =>
    api<{ ok: boolean; id: string }>("/safety/complaints", {
      method: "POST",
      body: JSON.stringify({
        requestId: body.requestId,
        reason: body.reason,
        body: body.description || body.body || "",
        subject: body.subject || `Dispute: ${body.reason}`,
        photos: body.photos || [],
      }),
    }),
};

export const PublicAPI = {
  pro: (code: string) => api<{ profile: WorkerPassport }>(`/public/pro/${encodeURIComponent(code)}`),
  watch: (token: string) =>
    api<{
      watch: {
        category: string;
        status: string;
        area: string;
        city: string;
        etaMinutes: number | null;
        delayReason: string;
        delayText: string;
        worker: { firstName: string; avatar: string; verified: boolean; rating: number } | null;
        workerApprox: { lat: number | null; lng: number | null };
        timeline: { status: string; note: string; at: string }[];
        expiresAt: string;
      };
    }>(`/public/watch/${encodeURIComponent(token)}`),
};

export type TeamPayload = {
  id?: string;
  ownerId?: string;
  groups: { id: string; name: string }[];
  members: { id: string; name: string; email: string; phone: string; role: string; groupId: string; status: string; userId: string | null }[];
  myRole?: string | null;
  canManage?: boolean;
  canAssign?: boolean;
};

export const StatsAPI = {
  mine: () => api<{ stats: Record<string, number> }>("/stats"),
};

export const AdminAPI = {
  overview: () => api<Record<string, unknown>>("/admin/overview"),
  users: (q = "") => api<{ users: AppUser[] }>(`/admin/users${q}`),
  user: (id: string) => api<{ user: AppUser; requests: JobRequest[]; reviews: unknown[] }>(`/admin/users/${id}`),
  createUser: (body: object) => api<{ user: AppUser }>("/admin/users", { method: "POST", body: JSON.stringify(body) }),
  requests: (q = "") => api<{ requests: JobRequest[] }>(`/admin/requests${q}`),
  patchUser: (id: string, body: object) =>
    api<{ user: AppUser }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  reviews: () => api<{ reviews: AdminReview[] }>("/admin/reviews"),
  complaints: () => api<{ complaints: AdminComplaint[] }>("/admin/complaints"),
  patchComplaint: (id: string, body: object) =>
    api<{ complaint: AdminComplaint }>(`/admin/complaints/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  transactions: () => api<{ transactions: AdminTxn[]; totals: Record<string, number> }>("/admin/transactions"),
  revenue: (q = "") =>
    api<{
      financialMode: string;
      label: string;
      range: string;
      summary: {
        gross: number;
        commission: number;
        providerNet: number;
        completedTransactions: number;
        pendingCommission: number;
      };
      periods: Record<string, { commission: number; gross: number; providerNet: number; transactions: number }>;
      transactions: {
        id: string;
        requestCode: string;
        providerName: string;
        category: string;
        gross: number;
        commission: number;
        net: number;
        commissionPercent: number;
        status: string;
        assignmentMode?: string;
        createdAt: string;
      }[];
    }>(`/admin/revenue${q}`),
  notifications: () => api<{ notifications: { _id: string; text: string; type: string; createdAt: string }[] }>("/admin/notifications"),
  broadcast: (body: object) => api<{ sent: number }>("/admin/notifications", { method: "POST", body: JSON.stringify(body) }),
  audit: () => api<{ logs: AdminAudit[] }>("/admin/audit"),
  analytics: () => api<{ byCategory: { _id: string; n: number }[]; byCity: { _id: string; n: number }[]; byDay: { _id: string; n: number; revenue: number; jobs?: number; users?: number }[]; licenses?: Record<string, number> }>("/admin/analytics"),
  settings: () => api<{ settings: AdminSettings; pendingMail?: number }>("/admin/settings"),
  patchSettings: (body: object) => api<{ settings: AdminSettings; pendingMail?: number }>("/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),
  testMail: (to?: string) =>
    api<{ ok: boolean; message: string }>("/admin/settings/test-mail", { method: "POST", body: JSON.stringify({ to }) }),
  grantLicense: (id: string, body: object) =>
    api<{ user: AppUser }>(`/admin/users/${id}/license`, { method: "POST", body: JSON.stringify(body) }),
  revokeLicense: (id: string) => api<{ user: AppUser }>(`/admin/users/${id}/license/revoke`, { method: "POST" }),
  licenses: () => api<{ licenses: { id: string; userCode: string; name: string; email: string; role: string; license: UserLicense }[] }>("/admin/licenses"),
  skillVerification: () =>
    api<{
      skills: { id: string; workerId: string; worker: string; email: string; name: string; level: string; requestedAt: string }[];
    }>("/admin/skill-verification"),
  reviewSkill: (workerId: string, skillId: string, body: object) =>
    api<{ ok: boolean }>(
      `/admin/skill-verification/${encodeURIComponent(workerId)}/${encodeURIComponent(skillId)}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
  safety: () =>
    api<{ incidents: { id: string; type: string; status: string; description: string; createdAt: string; workerId: string }[] }>(
      "/admin/safety"
    ),
  patchSafety: (id: string, body: object) =>
    api<{ ok: boolean }>(`/admin/safety/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  crews: () => api<{ crews: WorkerCrew[] }>("/admin/crews"),
  patchCrew: (id: string, body: object) =>
    api<{ ok: boolean }>(`/admin/crews/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export type AppUser = {
  id: string;
  userCode: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "worker" | "business" | "admin" | "provider";
  avatar: string;
  city: string;
  area: string;
  address: string;
  age?: number | null;
  jobType?: string;
  studies?: string;
  aadhaar?: string;
  pan?: string;
  lang?: "en" | "ta" | "hi";
  profileAsked?: boolean;
  lat?: number | null;
  lng?: number | null;
  homeLat?: number | null;
  homeLng?: number | null;
  lastSeenAt?: string | null;
  online?: boolean;
  status: string;
  walletBalance?: number;
  simulatedWalletPaise?: number;
  financialMode?: string;
  license?: UserLicense;
  requestCount?: number;
  completedCount?: number;
  createdAt?: string;
  provider: {
    businessName: string;
    category: string;
    services: (string | { name: string; price?: number })[];
    serviceAreas: string[];
    hours: { from: string; to: string };
    description: string;
    experience: string;
    verified: boolean;
    available: boolean;
    startingPrice: number;
    responseTime: string;
    ratingAvg: number;
    ratingCount: number;
    completedJobs: number;
    location: string;
    website?: string;
    photos: string[];
    coverPhoto: string;
    gstCertificate?: string;
    aadhaarCard?: string;
    panCard?: string;
    documents?: { name: string; url: string }[];
    lat?: number | null;
    lng?: number | null;
    onboarded: boolean;
    dailyTargetAmount?: number;
    nextJobAvailable?: boolean;
    languages?: string[];
    passportBio?: string;
    skills?: { id: string; name: string; verified: boolean; pending: boolean }[];
  } | null;
};

export type WorkPhotoItem = {
  url: string;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  caption?: string;
};

export type PriceChangeRequest = {
  id: string;
  requestedAmount: number;
  originalAmount: number;
  difference: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
  customerNote?: string;
};

export type MaterialRequest = {
  id: string;
  itemName: string;
  estimatedCost: number;
  receiptPhoto?: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
  customerNote?: string;
};

export type AssignmentHistoryItem = {
  workerId: string | null;
  workerName: string;
  assignedAt: string | null;
  releasedAt: string | null;
  reason: string;
  note?: string;
};

export type FinalBill = {
  baseAmount: number;
  approvedPriceChange: number;
  approvedMaterials: number;
  totalAmount: number;
  calculatedAt: string | null;
  confirmedByCustomer: boolean;
  confirmedAt: string | null;
};

export type RescheduleRequestItem = {
  requestedDate: string | null;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  requestedBy: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
};

export type RescheduleHistoryItem = {
  fromDate: string | null;
  toDate: string | null;
  reason: string;
  requestedBy: string | null;
  respondedBy: string | null;
  status: string;
  at: string | null;
};

export type WorkerMilestone = {
  id: string;
  title: string;
  description: string;
  icon: string;
  achieved: boolean;
  progress: number;
  threshold: number;
};

export type WorkerReliability = {
  factualMetrics: {
    completedJobs: number;
    cancelledJobs: number;
    completionRate: number;
    onTimeArrivalRate: number;
    repeatCustomerCount: number;
    verifiedSkillsCount: number;
    totalRatedJobs: number;
    averageRating: number;
  };
  milestones: WorkerMilestone[];
  worker: {
    id: string;
    name: string;
    verified: boolean;
    category: string;
    experience: string;
    skills: { id: string; name: string; verified: boolean; pending: boolean }[];
  };
};

export type JobDemandCluster = {
  clusterId: string;
  center: {
    lat: number;
    lng: number;
  };
  approxRadiusKm: number;
  activeDemandCount: number;
  priorityCounts: {
    normal: number;
    urgent: number;
    emergency: number;
  };
  categories: {
    [category: string]: number;
  };
  topCategory: string;
};

export type WorkerJobAlertPreferences = {
  nearbyRadiusKm: number;
  skillsOnly: boolean;
  emergencyAlerts: boolean;
  minJobAmount: number;
  soundEnabled: boolean;
};

export type JobRequest = {
  id: string;
  code: string;
  priority?: "normal" | "urgent" | "emergency";
  customerId: string | null;
  providerId: string | null;
  invitedProviderIds?: string[];
  postedByRole?: string;
  description: string;
  category: string;
  address: string;
  area: string;
  city: string;
  landmark?: string;
  lat?: number | null;
  lng?: number | null;
  workerLat?: number | null;
  workerLng?: number | null;
  workerLocationAt?: string | null;
  trackingActive?: boolean;
  arrivedAt?: string | null;
  photos?: string[];
  voiceNote?: string;
  timing: string;
  scheduledAt: string | null;
  scheduledLabel: string;
  estimatedAmount: number;
  budgetMin?: number;
  budgetMax?: number;
  workerQuote?: number | null;
  tags: string[];
  status: string;
  timeline: { status: string; note: string; at: string }[];
  createdAt?: string;
  updatedAt?: string;
  otpVerified?: boolean;
  jobOtp?: string;
  paymentStatus?: "unpaid" | "collected";
  paymentCollectedAt?: string | null;
  customerCompleted?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  customer: { id: string; name: string; avatar?: string; phone?: string } | null;
  provider: Provider | null;
  matches?: Provider[];
  crewId?: string | null;
  crewMemberIds?: string[];
  workersRequired?: number;
  cancelReason?: string;
  travelCompensation?: number;
  crewMembers?: {
    id: string;
    name: string;
    avatar?: string;
    state: string;
    category?: string;
    verified?: boolean;
    role?: string;
    isLead?: boolean;
  }[];
  crew?: { id: string | null; name: string } | null;
  acceptedAt?: string | null;
  customerLanguage?: string;
  workerLanguage?: string;
  translatedDescription?: string;
  workPhotos?: {
    before: WorkPhotoItem[];
    during: WorkPhotoItem[];
    after: WorkPhotoItem[];
  };
  workPhotoCount?: number;
  workPhotosUpdatedAt?: string | null;
  assignmentMode?: string;
  tower?: string;
  flat?: string;
  gateNote?: string;
  visitorName?: string;
  delayReason?: string;
  delayNote?: string;
  preferredProviderId?: string | null;
  pinCode?: string;
  cancelledAt?: string | null;
  cancelledBy?: string;
  watchActive?: boolean;
  cancelPolicy?: { free: boolean; afterTravel: boolean; amount: number; title: string; text: string };
  finance?: {
    mode: string;
    status: string;
    jobPricePaise: number;
    commissionPercent: number;
    commissionPaise: number;
    workerGrossPaise: number;
    workerNetPaise: number;
    calculatedAt: string | null;
    settled: boolean;
    jobPriceRupees: number;
    commissionRupees: number;
    workerGrossRupees: number;
    workerNetRupees: number;
    label: string;
  } | null;
  cancellationFinance?: {
    recorded: boolean;
    reason: string;
    cancelledBy: string;
    cancelledAt?: string | null;
    amountPaise: number;
    amountRupees: number;
    payer: string | null;
    receiver: string | null;
    financialStatus: string;
    scenario: string;
    label: string;
  } | null;
  priceChangeRequests?: PriceChangeRequest[];
  materialRequests?: MaterialRequest[];
  assignmentHistory?: AssignmentHistoryItem[];
  finalBill?: FinalBill | null;
  rescheduleRequest?: RescheduleRequestItem | null;
  rescheduleHistory?: RescheduleHistoryItem[];
};

export type Provider = {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviews: number;
  completedJobs: number;
  distance: string;
  responseTime: string;
  category: string;
  price: string;
  available: boolean;
  status?: "active" | "inactive";
  accountStatus?: "active" | "suspended";
  verified: boolean;
  description: string;
  experience: string;
  location: string;
  phone: string;
  services: (string | { name: string; price?: number })[];
  photos?: string[];
  coverPhoto?: string;
  hours?: { from: string; to: string };
  serviceAreas?: string[];
  website?: string;
  score?: number;
  reason?: string;
  lat?: number | null;
  lng?: number | null;
  lastSeenAt?: string | null;
  online?: boolean;
};

export type ChatThread = {
  id: string;
  requestId: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  service: string;
  status: string;
  phone?: string;
  online?: boolean;
};

export type ChatMsg = {
  id: string;
  senderId?: string;
  sender: "customer" | "provider";
  text: string;
  kind?: "text" | "image" | "voice";
  mediaUrl?: string;
  deleted?: boolean;
  durationSec?: number;
  time: string;
};

export type AppNotif = {
  id: string;
  type: string;
  text: string;
  read: boolean;
  requestId: string | null;
  time: string;
};

export type ReviewsPayload = {
  ratingAvg: number;
  ratingCount: number;
  distribution: number[];
  reviews: { id: string; requestId: string; customer: string; avatar: string; rating: number; comment: string; date: string }[];
};

export type ServiceCategory = {
  _id: string;
  name: string;
  icon: string;
  description: string;
  active: boolean;
  services: { _id?: string; name: string; priceFrom: number; active: boolean }[];
};

export type AdminReview = {
  id: string;
  requestId?: string;
  requestCode?: string;
  category?: string;
  rating: number;
  comment: string;
  createdAt: string;
  customer: string;
  provider: string;
};

export type AdminComplaint = {
  _id: string;
  code: string;
  party: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
};

export type AdminTxn = {
  _id: string;
  code: string;
  amount: number;
  amountPaise?: number;
  kind: string;
  type?: string;
  status: string;
  note: string;
  simulated?: boolean;
  financialMode?: string;
  createdAt: string;
};

export type AdminAudit = {
  _id: string;
  adminName: string;
  action: string;
  target: string;
  ip: string;
  createdAt: string;
};

export type UserLicense = {
  key: string;
  plan: string;
  days: number;
  startsAt: string | null;
  expiresAt: string | null;
  status: string;
  remainingDays: number;
  percent: number;
};

export type AdminSettings = {
  allowRegistrations: boolean;
  autoApproveProviders: boolean;
  supportEmail: string;
  googleClientId?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpPassSet?: boolean;
  commissionPercent: number;
  travelCompensationInr?: number;
  festivalName?: string;
  festivalCity?: string;
  festivalNote?: string;
  platformName: string;
  cancellationPolicy?: { version?: string; workerTravelCompensation?: number; workerTravelAfterMinutes?: number; customerCancelAfterAccept?: boolean };
};
