function apiBase() {
  const raw = String(import.meta.env.VITE_API_URL || "").trim();
  if (!raw) return "/api";
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

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("fb_token");
  const headers: Record<string, string> = {
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((opts.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message || "Request failed");
  return data as T;
}

export const AuthAPI = {
  login: (email: string, password: string, role?: string) =>
    api<{ token: string; user: AppUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, role }) }),
  signup: (body: object) =>
    api<{ token: string; user: AppUser }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  google: (credential: string, role?: string) =>
    api<{ token: string; user: AppUser }>("/auth/google", { method: "POST", body: JSON.stringify({ credential, role }) }),
  forgot: (email: string, role?: string) =>
    api<{ ok: boolean; message: string; otp?: string; queued?: boolean }>("/auth/forgot", { method: "POST", body: JSON.stringify({ email, role }) }),
  reset: (body: { email: string; otp: string; password: string; role?: string }) =>
    api<{ token: string; user: AppUser }>("/auth/reset", { method: "POST", body: JSON.stringify(body) }),
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
  accept: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/accept`, { method: "POST" }),
  decline: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/decline`, { method: "POST" }),
  schedule: (id: string, body: object) =>
    api<{ request: JobRequest }>(`/requests/${id}/schedule`, { method: "POST", body: JSON.stringify(body) }),
  start: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/start`, { method: "POST" }),
  complete: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/complete`, { method: "POST" }),
  cancel: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/cancel`, { method: "POST" }),
  review: (id: string, body: object) =>
    api<{ request: JobRequest }>(`/requests/${id}/review`, { method: "POST", body: JSON.stringify(body) }),
  quote: (id: string, amount: number) =>
    api<{ request: JobRequest }>(`/requests/${id}/quote`, { method: "POST", body: JSON.stringify({ amount }) }),
};

export const ChatAPI = {
  list: () => api<{ conversations: ChatThread[] }>("/conversations"),
  open: (requestId: string, providerId?: string) =>
    api<{ conversationId: string; requestId: string }>("/conversations/open", { method: "POST", body: JSON.stringify({ requestId, providerId }) }),
  messages: (id: string) => api<{ conversationId: string; requestId: string; messages: ChatMsg[] }>(`/conversations/${id}/messages`),
  send: (id: string, body: { text?: string; kind?: string; mediaUrl?: string }) =>
    api<{ message: ChatMsg }>(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(body) }),
};

export const NotifAPI = {
  list: () => api<{ unread: number; notifications: AppNotif[] }>("/notifications"),
  read: (ids?: string[]) => api("/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }),
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
  get: () => api<{ team: TeamPayload }>("/team"),
  addGroup: (name: string) => api<{ team: TeamPayload }>("/team/groups", { method: "POST", body: JSON.stringify({ name }) }),
  patchGroup: (id: string, body: object) => api<{ team: TeamPayload }>(`/team/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeGroup: (id: string) => api<{ team: TeamPayload }>(`/team/groups/${id}`, { method: "DELETE" }),
  addMember: (body: object) => api<{ team: TeamPayload }>("/team/members", { method: "POST", body: JSON.stringify(body) }),
  patchMember: (id: string, body: object) => api<{ team: TeamPayload }>(`/team/members/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeMember: (id: string) => api<{ team: TeamPayload }>(`/team/members/${id}`, { method: "DELETE" }),
};

export type TeamPayload = {
  id?: string;
  groups: { id: string; name: string }[];
  members: { id: string; name: string; email: string; phone: string; role: string; groupId: string; status: string; userId: string | null }[];
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
  lang?: "en" | "ta";
  profileAsked?: boolean;
  lat?: number | null;
  lng?: number | null;
  status: string;
  walletBalance?: number;
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
  } | null;
};

export type JobRequest = {
  id: string;
  code: string;
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
  customer: { id: string; name: string; avatar?: string; phone?: string } | null;
  provider: Provider | null;
  matches?: Provider[];
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
};

export type ChatMsg = {
  id: string;
  senderId?: string;
  sender: "customer" | "provider";
  text: string;
  kind?: "text" | "image" | "voice";
  mediaUrl?: string;
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
  kind: string;
  status: string;
  note: string;
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
  platformName: string;
};
