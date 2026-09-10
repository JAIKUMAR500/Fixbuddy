import React from "react";
import { Check } from "lucide-react";

export const JOB_STEPS = [
  { key: "accept", label: "Accept" },
  { key: "start", label: "Start work" },
  { key: "complete", label: "Complete" },
] as const;

export function jobStepIndex(status?: string | null) {
  const s = String(status || "");
  if (["completed", "reviewed"].includes(s)) return 3;
  if (s === "in_progress") return 2;
  if (["accepted", "scheduled"].includes(s)) return 1;
  return 0;
}

export function jobPrimaryAction(status?: string | null): "accept" | "start" | "complete" | null {
  const step = jobStepIndex(status);
  if (step === 0) return "accept";
  if (step === 1) return "start";
  if (step === 2) return "complete";
  return null;
}

export function JobProgress({ status }: { status?: string | null }) {
  const current = jobStepIndex(status);
  return (
    <ol className="flex items-center w-full">
      {JOB_STEPS.map((step, i) => {
        const done = current > i;
        const active = current === i;
        return (
          <li key={step.key} className={`flex items-center ${i < JOB_STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  done
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : active
                      ? "bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-200"
                      : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                {done ? <Check className="w-5 h-5" strokeWidth={3} /> : i + 1}
              </div>
              <p className={`mt-1.5 text-[11px] font-semibold whitespace-nowrap ${active ? "text-sky-700" : done ? "text-emerald-700" : "text-slate-400"}`}>
                {step.label}
              </p>
            </div>
            {i < JOB_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-5 rounded-full ${current > i ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
