import type { JobRequest } from "../types";
import { api } from "./api";

export const RequestAPI = {
  create: (body: object) => api<{ request: JobRequest }>("/requests", { method: "POST", body: JSON.stringify(body) }),
  list: (q = "") => api<{ requests: JobRequest[] }>(`/requests${q}`),
  get: (id: string) => api<{ request: JobRequest }>(`/requests/${id}`),
  currentJob: () => api<{ request: JobRequest | null; locked?: boolean }>("/requests/current-job"),
  accept: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/accept`, { method: "POST" }),
  enroute: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/enroute`, { method: "POST", body: JSON.stringify({}) }),
  arrive: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/arrive`, { method: "POST", body: JSON.stringify({}) }),
  verifyOtp: (id: string, otp: string) =>
    api<{ request: JobRequest }>(`/requests/${id}/verify-otp`, { method: "POST", body: JSON.stringify({ otp }) }),
  start: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/start`, { method: "POST" }),
  complete: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/complete`, { method: "POST" }),
  collect: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/collect-payment`, { method: "POST" }),
  review: (id: string, body: { rating: number; comment?: string }) =>
    api<{ request: JobRequest }>(`/requests/${id}/review`, { method: "POST", body: JSON.stringify(body) }),
  cancel: (id: string) => api<{ request: JobRequest }>(`/requests/${id}/cancel`, { method: "POST", body: JSON.stringify({}) }),
  priceBand: (q: string) => api<{ text?: string }>(`/requests/price-band${q}`),
};

export const UploadAPI = {
  dataUrl: (dataUrl: string, filename = "photo.jpg") =>
    api<{ url: string }>("/upload", { method: "POST", body: JSON.stringify({ dataUrl, filename }) }),
};

export const CategoryAPI = {
  list: () => api<{ categories: { name: string; icon?: string }[] }>("/categories"),
};

export const WorkerAPI = {
  dashboard: () =>
    api<{
      greeting: string;
      target: { amount: number; earned: number; remaining: number; percent: number };
      recommended: { id: string; category: string; amount?: number; distanceKm?: number; area?: string; status?: string }[];
      nearbyCount: number;
      locked: boolean;
      activeJob: { id: string; category: string; status: string } | null;
      passport: { jobs: number; ratingAvg: number };
    }>("/worker/dashboard"),
};
