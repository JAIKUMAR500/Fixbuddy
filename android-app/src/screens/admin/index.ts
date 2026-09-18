import type { ScreenDef } from "../../config/app";

/** Admin stays on the website in v1. Not a mobile target. */
export const ADMIN_SCREENS: ScreenDef[] = [
  {
    id: "admin-login",
    role: "admin",
    title: "Admin login",
    web: "frontend/src/pages/admin/AdminLogin.tsx",
    v1: false,
  },
  {
    id: "admin-portal",
    role: "admin",
    title: "Admin portal",
    web: "frontend/src/pages/admin/AdminPortal.tsx",
    v1: false,
  },
];
