/** Paths already served by backend/. Android uses the same /api client. */
export const ENDPOINTS = {
  health: "/health",
  ready: "/ready",
  login: "/auth/login",
  signup: "/auth/signup",
  logout: "/auth/logout",
  me: "/auth/me",
  currentJob: "/requests/current-job",
  requests: "/requests",
  upload: "/upload",
  notifications: "/notifications",
  chat: "/chat",
  reviews: "/reviews",
  categories: "/categories",
} as const;
