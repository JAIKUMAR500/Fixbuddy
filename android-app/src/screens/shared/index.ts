import type { ScreenDef } from "../../config/app";

export const SHARED_V1: ScreenDef[] = [
  {
    id: "messages",
    role: "shared",
    title: "Messages",
    web: "frontend/src/pages/shared/MessagesInbox.tsx",
    v1: true,
  },
  {
    id: "account",
    role: "shared",
    title: "Account",
    web: "frontend/src/pages/shared/AccountSettings.tsx",
    v1: true,
  },
];
