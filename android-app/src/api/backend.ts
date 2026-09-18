/** Existing Express API. Do not add a second backend for Android. */
export const LIVE_API = "https://fixbuddy-1-nh5a.onrender.com";
export const LOCAL_API = "http://127.0.0.1:4000";
export const EMULATOR_API = "http://10.0.2.2:4000";

export const API_CODE = {
  app: "backend/src/app.js",
  env: "backend/src/config/env.js",
  requests: "backend/src/routes/requests.js",
  auth: "backend/src/routes/auth.js",
} as const;

export function apiRoot(origin = LIVE_API) {
  return `${origin.replace(/\/$/, "")}/api`;
}
