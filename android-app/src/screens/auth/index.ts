import type { ScreenDef } from "../../config/app";

export const AUTH_SCREENS: ScreenDef[] = [
  {
    id: "login",
    role: "shared",
    title: "Login",
    web: "frontend/src/pages/Auth.tsx",
    v1: true,
  },
  {
    id: "signup",
    role: "shared",
    title: "Sign up",
    web: "frontend/src/pages/Auth.tsx",
    v1: true,
  },
];
