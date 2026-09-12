import React, { useState } from "react";
import { Button, Card } from "./ui";
import type { JobRequest } from "../api/client";

const WORKER_REASONS = [
  "Emergency",
  "Customer requested cancellation",
  "Wrong job information",
  "Unsafe location",
  "Vehicle problem",
  "Personal emergency",
  "Other",
];

const CUSTOMER_REASONS = [
  "Changed plans",
  "Worker delayed",
  "Found another option",
  "Wrong location",
  "Other",
];

export default function CancelJobPanel({
  worker,
  job,
  policy,
  busy,
  onCancel,
}: {
  worker: boolean;
  job: Pick<JobRequest, "id" | "code" | "category" | "description" | "status">;
  policy?: JobRequest["cancelPolicy"] | null;
  busy?: boolean;
  onCancel: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reasons = worker ? WORKER_REASONS : CUSTOMER_REASONS;

  return (
    <Card padding="md" className="border-red-100 bg-red-50/60 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Cancel this job</p>
        <p className="mt-1 font-semibold text-slate-900">{job.category}</p>
        <p className="text-xs text-slate-600 line-clamp-2">{job.description}</p>
        <p className="mt-1 text-xs text-slate-500">{job.code} · {job.status.replace(/_/g, " ")}</p>
        <p className="text-sm text-slate-700 mt-1">
          {policy?.text || "You can cancel once, including after arrival or after work starts. After that this job is closed."}
        </p>
      </div>
      {!open ? (
        <button
          type="button"
          className="w-full min-h-12 rounded-xl border border-red-200 bg-white text-red-700 font-semibold disabled:opacity-50"
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          Cancel job
        </button>
      ) : (
        <div className="space-y-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Why are you cancelling?</option>
            {reasons.map((row) => (
              <option key={row} value={row}>
                {row}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">This cannot be undone. One cancel closes the job for both sides.</p>
          <Button
            variant="danger"
            className="w-full min-h-12"
            disabled={busy || !reason}
            onClick={() => onCancel(reason)}
          >
            {busy ? "Cancelling..." : "Confirm cancel"}
          </Button>
          <button type="button" className="w-full min-h-11 text-sm font-semibold text-slate-500" onClick={() => setOpen(false)}>
            Keep job
          </button>
        </div>
      )}
    </Card>
  );
}
