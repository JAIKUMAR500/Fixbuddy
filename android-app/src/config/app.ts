export const APP_ID = "com.fixbuddy.app";
export const APP_NAME = "FixBuddy";

export const WEB_ENTRY = "frontend/src/App.tsx";
export const API_ENTRY = "backend/src/index.js";

export type AppRole = "customer" | "worker" | "business";

export type ScreenDef = {
  id: string;
  role: AppRole | "shared" | "admin";
  title: string;
  web: string;
  v1: boolean;
};

export const V1_RULES = {
  reuseExistingBackend: true,
  reuseExistingWebUi: true,
  adminOnWebOnly: true,
  noSecondJobStatusSystem: true,
  currentJobSourceOfTruth: "GET /api/requests/current-job",
  financialMode: "development",
} as const;
