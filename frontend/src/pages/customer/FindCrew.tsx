import React, { useEffect, useState } from "react";
import { Users, Star } from "lucide-react";
import { View } from "../../types";
import { Button, Card, EmptyState } from "../../components/ui";
import { CrewAPI, type WorkerCrew } from "../../api/client";
import { useApp } from "../../api/AppContext";

export default function FindCrew({ navigate }: { navigate: (v: View) => void }) {
  const { activeRequestId, requestData, jobFocusLocked } = useApp();
  const needed = Math.max(2, Number((requestData as { workersRequired?: number })?.workersRequired || 2));
  const [crews, setCrews] = useState<WorkerCrew[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    void CrewAPI.browse(`&workers=${needed}`)
      .then((d) => setCrews(d.crews))
      .catch((e: Error) => setError(e.message));
  }, [needed]);

  const request = async (id: string) => {
    if (!activeRequestId) {
      setError("Post a job first, then request a team.");
      navigate("create-request");
      return;
    }
    setBusy(id);
    setError("");
    try {
      await CrewAPI.requestJob(id, activeRequestId, needed);
      setMsg("Team request sent. The team leader will accept or decline.");
      navigate("request-status");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request this team");
    } finally {
      setBusy("");
    }
  };

  if (jobFocusLocked) {
    return (
      <div className="p-4 lg:p-6 max-w-xl">
        <h1 className="font-display text-2xl font-bold text-slate-900">Active job in progress</h1>
        <p className="text-sm text-slate-600 mt-2">Your current job is active. Open your current job to continue.</p>
        <Button className="mt-4" fullWidth onClick={() => navigate("active-job")}>
          Go to Active Request
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Multi-worker job</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">Find a crew</h1>
        <p className="text-sm text-slate-500 mt-1">Showing crews with at least {needed} active members. Crews are independent workers collaborating — not a Business Team.</p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{msg}</p>}
      <div className="space-y-3">
        {crews.map((c) => (
          <Card key={c.id} padding="md" className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">{c.leader?.name} · {c.skills.join(" · ") || "Multi-skill"}</p>
              </div>
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                <Star className="w-3 h-3" /> {c.ratingAvg || "New"}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-3">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.activeCount} workers</span>
              <span>{c.completedJobs} jobs</span>
              <span>{c.serviceArea || "Any area"}</span>
            </p>
            <div className="flex flex-wrap gap-1">
              {c.members.filter((m) => m.status === "active").map((m) => (
                <span key={m.id} className="text-[11px] bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                  {m.name} · {m.category || m.role}
                </span>
              ))}
            </div>
            <Button fullWidth loading={busy === c.id} onClick={() => void request(c.id)}>
              Request this crew
            </Button>
          </Card>
        ))}
        {!crews.length && (
          <EmptyState
            icon="👥"
            title="No eligible crews yet"
            description="You can still book a single worker from Find a Service."
            actionLabel="Find a worker"
            onAction={() => navigate("create-request")}
          />
        )}
      </div>
    </div>
  );
}
