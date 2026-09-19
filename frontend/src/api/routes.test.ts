import { describe, expect, it } from "vitest";
import type { View } from "../types";
import { matchRoute, passportCodeFromPath, pathForView, publicProfileCode, watchTokenFromPath } from "./routes";
import { ADMIN_VIEWS, BUSINESS_VIEWS, CUSTOMER_VIEWS, WORKER_VIEWS, canAccessView } from "./roles";
import type { AppUser } from "./client";

function userOf(role: string): AppUser {
  return { id: "u1", role, name: "Test" } as unknown as AppUser;
}

describe("specification routes", () => {
  const cases: [string, View, string | null][] = [
    ["/", "landing", null],
    ["/business", "business-landing", null],
    ["/login", "login", null],
    ["/admin-login", "admin-login", null],
    ["/customer/home", "customer-home", "customer"],
    ["/customer/create-request", "create-request", "customer"],
    ["/customer/requests", "my-requests", "customer"],
    ["/customer/find-crew", "find-crew", "customer"],
    ["/customer/profile", "customer-profile", "customer"],
    ["/business/dashboard", "business-dashboard", "business"],
    ["/business/onboarding", "business-onboarding", "business"],
    ["/business/requests", "work-requests", "worker"],
    ["/business/jobs", "my-jobs", "business"],
    ["/business/calendar", "business-calendar", "business"],
    ["/business/earnings", "earnings", "business"],
    ["/business/team", "business-team", "business"],
    ["/business/profile", "business-profile", "business"],
    ["/worker/target", "worker-target", "worker"],
    ["/worker/jobs", "worker-next-jobs", "worker"],
    ["/worker/crews", "worker-crews", "worker"],
    ["/worker/safety", "worker-safety", "worker"],
    ["/worker/passport", "worker-passport", "worker"],
    ["/job/active", "active-job", "customer"],
    ["/analytics", "business-analytics", "business"],
  ];

  it.each(cases)("%s resolves to the %s view", (path, view, role) => {
    expect(matchRoute(path, role)?.view).toBe(view);
  });

  it.each(cases)("%s is the canonical URL for %s", (path, view, role) => {
    expect(pathForView(view, { role })).toBe(path);
  });

  it("maps request and chat detail params", () => {
    expect(matchRoute("/customer/requests/abc123", "customer")).toEqual({
      view: "request-status",
      requestId: "abc123",
    });
    expect(pathForView("request-status", { requestId: "abc123" })).toBe("/customer/requests/abc123");
    expect(matchRoute("/chat/job9", "customer")).toEqual({ view: "customer-messages", requestId: "job9" });
    expect(matchRoute("/chat/job9", "worker")).toEqual({ view: "business-messages", requestId: "job9" });
    expect(pathForView("business-messages", { requestId: "job9" })).toBe("/chat/job9");
  });

  it("resolves shared screens by role", () => {
    expect(matchRoute("/wallet", "customer")?.view).toBe("customer-wallet");
    expect(matchRoute("/wallet", "worker")?.view).toBe("worker-wallet");
    expect(matchRoute("/wallet", "business")?.view).toBe("business-wallet");
    expect(matchRoute("/settings", "customer")?.view).toBe("customer-settings");
    expect(matchRoute("/settings", "worker")?.view).toBe("provider-settings");
    expect(matchRoute("/settings", "admin")?.view).toBe("admin-settings");
  });

  it("covers the admin portal namespace", () => {
    expect(matchRoute("/admin/portal", "admin")?.view).toBe("admin");
    expect(matchRoute("/admin/portal/users", "admin")?.view).toBe("admin-users");
    expect(matchRoute("/admin/portal/verification", "admin")?.view).toBe("admin-verification");
    expect(pathForView("admin-crews")).toBe("/admin/portal/crews");
    for (const view of ADMIN_VIEWS) {
      expect(pathForView(view).startsWith("/admin/portal")).toBe(true);
    }
  });

  it("reads public profile and watch links from the path", () => {
    expect(publicProfileCode("/workers/FB-123")).toBe("FB-123");
    expect(publicProfileCode("/pro/FB-123")).toBe("FB-123");
    expect(publicProfileCode("/customer/home")).toBe("");
    expect(watchTokenFromPath("/watch/tok123")).toBe("tok123");
    expect(passportCodeFromPath("/passport/FB-9")).toBe("FB-9");
    expect(pathForView("family-watch", { code: "tok123" })).toBe("/watch/tok123");
    expect(pathForView("public-passport", { code: "FB-9" })).toBe("/passport/FB-9");
  });

  it("returns null for unknown paths so the app can fall back", () => {
    expect(matchRoute("/does-not-exist", "customer")).toBeNull();
    expect(matchRoute("/customer/nope", "customer")).toBeNull();
  });

  it("ignores trailing slashes and query strings", () => {
    expect(matchRoute("/customer/home/", "customer")?.view).toBe("customer-home");
    expect(matchRoute("/customer/home?x=1", "customer")?.view).toBe("customer-home");
  });
});

describe("every view keeps a unique, reversible URL", () => {
  const allViews = new Set<View>([
    ...CUSTOMER_VIEWS,
    ...WORKER_VIEWS,
    ...BUSINESS_VIEWS,
    ...ADMIN_VIEWS,
    "landing",
    "login",
    "signup",
    "business-landing",
    "admin-login",
    "job-details",
    "work-requests",
  ]);

  it("gives every view a non-root path except landing", () => {
    for (const view of allViews) {
      if (view === "landing") continue;
      expect(pathForView(view), `missing path for ${view}`).not.toBe("/");
    }
  });

  it("round-trips each role's views back to the same view", () => {
    const roles: [string, View[]][] = [
      ["customer", CUSTOMER_VIEWS],
      ["worker", WORKER_VIEWS],
      ["business", BUSINESS_VIEWS],
      ["admin", ADMIN_VIEWS],
    ];
    for (const [role, views] of roles) {
      for (const view of views) {
        if (view === "public-passport" || view === "family-watch") continue;
        const path = pathForView(view, { role, requestId: "r1" });
        expect(matchRoute(path, role)?.view, `${role} ${view} -> ${path}`).toBe(view);
      }
    }
  });
});

describe("role guards still decide access", () => {
  it("blocks a customer from worker-only routes", () => {
    const route = matchRoute("/worker/passport", "customer");
    expect(route?.view).toBe("worker-passport");
    expect(canAccessView(userOf("customer"), route!.view)).toBe(false);
  });

  it("blocks an anonymous visitor from private routes", () => {
    const route = matchRoute("/customer/home", null);
    expect(canAccessView(null, route!.view)).toBe(false);
  });

  it("allows public routes without a session", () => {
    for (const path of ["/", "/login", "/business", "/admin-login"]) {
      const route = matchRoute(path, null);
      expect(canAccessView(null, route!.view), path).toBe(true);
    }
  });

  it("keeps admin access to the portal", () => {
    expect(canAccessView(userOf("admin"), matchRoute("/admin/portal/users", "admin")!.view)).toBe(true);
    expect(canAccessView(userOf("worker"), "admin-users")).toBe(false);
  });
});
