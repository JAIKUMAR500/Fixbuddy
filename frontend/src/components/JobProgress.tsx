import React from "react";
import { Check } from "lucide-react";
import { jobStepIndex } from "../api/jobLock";

export { jobStepIndex };

export const JOB_STEPS = [
  { key: "request", label: "Searching" },
  { key: "accepted", label: "Accepted" },
  { key: "travel", label: "On the way" },
  { key: "arrived", label: "Arrived" },
  { key: "verified", label: "OTP verified" },
  { key: "working", label: "Work started" },
  { key: "completed", label: "Work completed" },
] as const;

export function jobPrimaryAction(
  status?: string | null
): "accept" | "enroute" | "arrive" | "otp" | "start" | "complete" | "collect" | null {
  const s = String(status || "");
  if (["open", "requested", "matching"].includes(s)) return "accept";
  if (["accepted", "scheduled"].includes(s)) return "enroute";
  if (s === "on_the_way") return "arrive";
  if (s === "arrived") return "otp";
  if (s === "otp_verified") return "start";
  if (s === "in_progress") return "complete";
  if (s === "completed") return "collect";
  return null;
}

export function JobProgress({ status }: { status?: string | null }) {
  const current = Math.min(jobStepIndex(status), JOB_STEPS.length);
  return (
    <ol className="flex items-center w-full overflow-x-auto no-scrollbar">
      {JOB_STEPS.map((step, i) => {
        const done = current > i;
        const active = current === i;
        return (
          <li key={step.key} className={`flex items-center ${i < JOB_STEPS.length - 1 ? "flex-1 min-w-[4.2rem]" : ""}`}>
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                  done
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : active
                      ? "bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-200"
                      : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                {done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </div>
              <p className={`mt-1 text-[10px] font-semibold whitespace-nowrap ${active ? "text-sky-700" : done ? "text-emerald-700" : "text-slate-400"}`}>
                {step.label}
              </p>
            </div>
            {i < JOB_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 rounded-full ${current > i ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
