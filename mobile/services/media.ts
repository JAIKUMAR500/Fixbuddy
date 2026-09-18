import { BASE } from "../config/env";

export function mediaUrl(url?: string | null) {
  if (!url) return "";
  const raw = String(url).trim();
  if (/^(data:|blob:)/i.test(raw)) return raw;
  const apiOrigin = BASE.replace(/\/api\/?$/, "");
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
