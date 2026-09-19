import type { APIRequestContext, Page } from "@playwright/test";

export const API = process.env.E2E_API_URL || "http://127.0.0.1:4000";

export type Account = {
  email: string;
  password: string;
  role: "customer" | "worker" | "business";
  token: string;
  id: string;
  userCode: string;
  name: string;
};

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Registers a fresh account through the real API. */
export async function register(
  api: APIRequestContext,
  role: Account["role"],
  overrides: Record<string, unknown> = {}
): Promise<Account> {
  const handle = unique(role);
  const email = `${handle}@e2e.fixbuddy.test`;
  const password = "E2ePassw0rd!";
  const name = `E2E ${role} ${handle.slice(-6)}`;
  const res = await api.post(`${API}/api/auth/signup`, {
    data: {
      name,
      email,
      password,
      role,
      phone: "9345040779",
      city: "Coimbatore",
      area: "Peelamedu",
      address: "12 Test Street",
      lat: 11.0168,
      lng: 76.9558,
      ...overrides,
    },
  });
  if (!res.ok()) throw new Error(`signup failed for ${role}: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await api.patch(`${API}/api/auth/me`, {
    headers: { Authorization: `Bearer ${body.token}`, "Content-Type": "application/json" },
    data: { profileAsked: true },
  });
  return { email, password, role, token: body.token, id: body.user.id, userCode: body.user.userCode, name };
}

export function authHeaders(account: Account) {
  return { Authorization: `Bearer ${account.token}`, "Content-Type": "application/json" };
}

/** Finishes worker/business onboarding so the dashboard is reachable. */
export async function completeOnboarding(api: APIRequestContext, account: Account, category = "Plumbing") {
  const res = await api.post(`${API}/api/providers/onboarding`, {
    headers: authHeaders(account),
    data: {
      businessName: account.name,
      category,
      services: [category],
      serviceAreas: ["Peelamedu"],
      city: "Coimbatore",
      area: "Peelamedu",
      address: "12 Test Street",
      lat: 11.0168,
      lng: 76.9558,
    },
  });
  if (!res.ok()) throw new Error(`onboarding failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

/** Puts a real session into the browser the way the app does. */
export async function signIn(page: Page, account: Account) {
  await page.addInitScript((token) => {
    window.localStorage.setItem("fb_token", token as string);
  }, account.token);
}

export async function createJob(api: APIRequestContext, customer: Account, category = "Plumbing") {
  const res = await api.post(`${API}/api/requests`, {
    headers: authHeaders(customer),
    data: {
      category,
      description: "E2E kitchen tap is leaking and needs a new washer.",
      address: "12 Test Street",
      area: "Peelamedu",
      city: "Coimbatore",
      timing: "asap",
      publicPost: true,
      estimatedAmount: 1000,
      lat: 11.0168,
      lng: 76.9558,
    },
  });
  if (!res.ok()) throw new Error(`create request failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return body.request;
}
