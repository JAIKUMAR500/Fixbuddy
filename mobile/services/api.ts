import type { AppUser } from "../types";
import { BASE } from "../config/env";
import { getToken, setToken } from "./session";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((opts.headers as Record<string, string>) || {}),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${BASE}${path}`, { ...opts, headers, signal: controller.signal });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token && !path.startsWith("/auth/login") && !path.startsWith("/auth/signup")) {
        await setToken("");
      }
      throw new ApiError(res.status, data.message || "Request failed");
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "Connection lost. Retrying is safe — the job on the server stays as it is.");
  } finally {
    clearTimeout(timer);
  }
}

export const AuthAPI = {
  login: (email: string, password: string, role?: string) =>
    api<{ token: string; user: AppUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),
  signup: (body: { name: string; email: string; password: string; role: string }) =>
    api<{ token: string; user: AppUser }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => api<{ user: AppUser }>("/auth/me"),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
  forgot: (email: string, role?: string) =>
    api<{ ok: boolean; message: string; otp?: string }>("/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  reset: (body: { email: string; otp: string; password: string; role?: string }) =>
    api<{ token: string; user: AppUser }>("/auth/reset", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export async function persistSession(token: string) {
  await setToken(token);
}
