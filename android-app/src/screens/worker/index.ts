import type { ScreenDef } from "../../config/app";

export const WORKER_V1: ScreenDef[] = [
  {
    id: "work-requests",
    role: "worker",
    title: "Jobs",
    web: "frontend/src/pages/business/WorkRequests.tsx",
    v1: true,
  },
  {
    id: "active-job",
    role: "worker",
    title: "Active job",
    web: "frontend/src/pages/shared/ActiveJob.tsx",
    v1: true,
  },
  {
    id: "worker-passport",
    role: "worker",
    title: "Skill passport",
    web: "frontend/src/pages/worker/WorkerPassport.tsx",
    v1: true,
  },
  {
    id: "worker-safety",
    role: "worker",
    title: "Safety",
    web: "frontend/src/pages/worker/WorkerSafety.tsx",
    v1: true,
  },
];

export const WORKER_MORE: ScreenDef[] = [
  { id: "my-jobs", role: "worker", title: "My jobs", web: "frontend/src/pages/business/MyJobs.tsx", v1: false },
  { id: "earnings", role: "worker", title: "Earnings", web: "frontend/src/pages/business/Earnings.tsx", v1: false },
];
