import type { View } from "../types";
import { isBusiness } from "./roles";

/**
 * URL map for the existing view state machine. The views stay the source of
 * truth for guards and the active-job lock; these paths give every screen a
 * real URL so refresh, deep links, and Back/Forward behave normally.
 */

export type RouteMatch = { view: View; requestId?: string; code?: string; token?: string };

const ADMIN_SLUGS: Partial<Record<View, string>> = {
  admin: "",
  "admin-customers": "customers",
  "admin-providers": "providers",
  "admin-workers": "workers",
  "admin-verification": "verification",
  "admin-requests": "requests",
  "admin-reviews": "reviews",
  "admin-settings": "settings",
  "admin-categories": "categories",
  "admin-services": "services",
  "admin-jobs": "jobs",
  "admin-notifications": "notifications",
  "admin-complaints": "complaints",
  "admin-transactions": "transactions",
  "admin-analytics": "analytics",
  "admin-users": "users",
  "admin-audit": "audit",
  "admin-licenses": "licenses",
  "admin-safety": "safety",
  "admin-crews": "crews",
};

/** Screens that exist for several roles and therefore share one URL. */
const SHARED_PATHS = {
  wallet: "/wallet",
  settings: "/settings",
  analytics: "/analytics",
  chat: "/chat",
} as const;

const STATIC_PATHS: Record<string, string> = {
  landing: "/",
  login: "/login",
  signup: "/signup",
  "business-landing": "/business",
  "admin-login": "/admin-login",
  "public-passport": "/passport",
  "family-watch": "/watch",

  "customer-home": "/customer/home",
  "create-request": "/customer/create-request",
  "finding-solutions": "/customer/finding-solutions",
  "matched-providers": "/customer/matches",
  "provider-details": "/customer/provider",
  "my-requests": "/customer/requests",
  "find-crew": "/customer/find-crew",
  "customer-profile": "/customer/profile",
  "customer-notifications": "/customer/notifications",
  "customer-bookings": "/customer/bookings",
  "customer-reviews": "/customer/reviews",
  "customer-license": "/customer/license",
  "customer-support": "/customer/support",
  "customer-favorites": "/customer/saved",

  "business-onboarding": "/business/onboarding",
  "business-dashboard": "/business/dashboard",
  "work-requests": "/business/requests",
  "my-jobs": "/business/jobs",
  "business-calendar": "/business/calendar",
  reviews: "/business/reviews",
  earnings: "/business/earnings",
  "business-profile": "/business/profile",
  "business-notifications": "/business/notifications",
  "provider-services": "/business/services",
  "business-license": "/business/license",
  "business-team": "/business/team",

  "worker-target": "/worker/target",
  "worker-next-jobs": "/worker/jobs",
  "worker-crews": "/worker/crews",
  "worker-passport": "/worker/passport",
  "worker-safety": "/worker/safety",
  "worker-license": "/worker/license",

  "ai-recommend": "/ai-recommend",
  "active-job": "/job/active",

  "customer-wallet": SHARED_PATHS.wallet,
  "worker-wallet": SHARED_PATHS.wallet,
  "business-wallet": SHARED_PATHS.wallet,
  "customer-settings": SHARED_PATHS.settings,
  "provider-settings": SHARED_PATHS.settings,
  "business-analytics": SHARED_PATHS.analytics,
  "customer-messages": SHARED_PATHS.chat,
  "business-messages": SHARED_PATHS.chat,
};

/** Detail screens keep a list path plus an `/:id` path. */
const DETAIL_BASE: Partial<Record<View, string>> = {
  "request-status": "/customer/requests",
  "job-details": "/business/jobs",
};

function trimPath(pathname: string) {
  const clean = String(pathname || "/").split("?")[0].split("#")[0];
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

function segments(pathname: string) {
  return trimPath(pathname).split("/").filter(Boolean);
}

export function pathForView(
  view: View,
  opts: { requestId?: string | null; role?: string | null; code?: string | null } = {}
): string {
  const adminSlug = ADMIN_SLUGS[view];
  if (adminSlug !== undefined) return adminSlug ? `/admin/portal/${adminSlug}` : "/admin/portal";

  const detailBase = DETAIL_BASE[view];
  if (detailBase) return opts.requestId ? `${detailBase}/${opts.requestId}` : detailBase;

  if (view === "customer-messages" || view === "business-messages") {
    return opts.requestId ? `${SHARED_PATHS.chat}/${opts.requestId}` : SHARED_PATHS.chat;
  }

  // The watch token and the professional code live in the URL itself.
  if (view === "family-watch") return opts.code ? `/watch/${opts.code}` : "/watch";
  if (view === "public-passport") return opts.code ? `/passport/${opts.code}` : "/passport";

  return STATIC_PATHS[view] || "/";
}

function walletView(role?: string | null): View {
  if (role === "worker") return "worker-wallet";
  if (isBusiness(role)) return "business-wallet";
  return "customer-wallet";
}

function settingsView(role?: string | null): View {
  if (role === "admin") return "admin-settings";
  if (role === "worker" || isBusiness(role)) return "provider-settings";
  return "customer-settings";
}

function chatView(role?: string | null): View {
  if (role === "worker" || isBusiness(role) || role === "admin") return "business-messages";
  return "customer-messages";
}

function analyticsView(role?: string | null): View {
  if (role === "admin") return "admin-analytics";
  return "business-analytics";
}

/** Reverse lookup. Returns null when the path is not an app route. */
export function matchRoute(pathname: string, role?: string | null): RouteMatch | null {
  const parts = segments(pathname);
  const path = trimPath(pathname);

  if (parts.length === 0) return { view: "landing" };

  // Public worker profile keeps its own components and path-based codes.
  if ((parts[0] === "workers" || parts[0] === "pro") && parts[1]) {
    return { view: "public-passport", code: parts[1] };
  }
  if (parts[0] === "watch") {
    return { view: "family-watch", token: parts[1] || "" };
  }
  if (parts[0] === "passport") {
    return { view: "public-passport", code: parts[1] || "" };
  }
  if (parts[0] === "admin" && parts[1] === "portal") {
    const slug = parts[2] || "";
    const found = (Object.keys(ADMIN_SLUGS) as View[]).find((key) => ADMIN_SLUGS[key] === slug);
    return { view: found || "admin" };
  }
  if (parts[0] === "chat") {
    return { view: chatView(role), requestId: parts[1] };
  }
  if (path === SHARED_PATHS.wallet) return { view: walletView(role) };
  if (path === SHARED_PATHS.settings) return { view: settingsView(role) };
  if (path === SHARED_PATHS.analytics) return { view: analyticsView(role) };

  for (const [view, base] of Object.entries(DETAIL_BASE) as [View, string][]) {
    const baseParts = segments(base);
    if (parts.length === baseParts.length + 1 && baseParts.every((seg, i) => parts[i] === seg)) {
      return { view, requestId: parts[baseParts.length] };
    }
  }

  const staticMatch = (Object.keys(STATIC_PATHS) as View[]).find(
    (view) => STATIC_PATHS[view] === path && !DETAIL_BASE[view]
  );
  if (staticMatch) return { view: staticMatch };

  return null;
}

/** True when the path renders the standalone public professional profile. */
export function publicProfileCode(pathname: string) {
  const parts = segments(pathname);
  if ((parts[0] === "workers" || parts[0] === "pro") && parts[1]) return parts[1];
  return "";
}

export function watchTokenFromPath(pathname: string) {
  const parts = segments(pathname);
  return parts[0] === "watch" ? parts[1] || "" : "";
}

/** Professional code from `/passport/:code`, `/pro/:code`, or `/workers/:code`. */
export function passportCodeFromPath(pathname: string) {
  const parts = segments(pathname);
  if (["passport", "pro", "workers"].includes(parts[0] || "") && parts[1]) return parts[1];
  return "";
}
