import { defineConfig, devices } from "@playwright/test";

const FRONTEND = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const API = process.env.E2E_API_URL || "http://127.0.0.1:4000";

/**
 * E2E runs against the real Express API and a real MongoDB, in simulated
 * financial mode. No gateway credentials are used or required.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { outputFolder: "playwright-report" }]] : [["list"]],
  use: {
    baseURL: FRONTEND,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm --prefix backend run dev",
      url: `${API}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { FINANCIAL_MODE: "development", E2E: "1" },
    },
    {
      command: "npm --prefix frontend run dev",
      url: FRONTEND,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_E2E: "1" },
    },
  ],
});
