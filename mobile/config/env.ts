import { LIVE_API } from "../constants/theme";

export function apiOrigin() {
  const raw = String(process.env.EXPO_PUBLIC_API_URL || LIVE_API).trim().replace(/\/$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export const BASE = apiOrigin();
