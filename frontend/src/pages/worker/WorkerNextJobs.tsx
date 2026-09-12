import React, { useEffect, useState } from "react";
import { MapPin, Clock, Flame, Navigation } from "lucide-react";
import { View } from "../../types";
import { Button, Card, EmptyState } from "../../components/ui";
import { AuthAPI, RequestAPI, WorkerAPI, type WorkerJobCard } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { readGps } from "../../api/geo";
import { jobError } from "../../api/jobLock";

const FILTERS: { id: string; label: string }[] = [
  { id: "recommended", label: "Best nearby" },
  { id: "home", label: "On my way home" },
  { id: "nearest", label: "Nearest" },
  { id: "earning", label: "Highest earning" },
  { id: "urgent", label: "Urgent" },
];

export default function WorkerNextJobs({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId, setUser, user } = useApp();
  const [jobs, setJobs] = useState<WorkerJobCard[]>([]);
  const [best, setBest] = useState<WorkerJobCard | null>(null);
  const [sort, setSort] = useState("recommended");
  const [remaining, setRemaining] = useState(0);
  const [gpsOk, setGpsOk] = useState(true);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [gpsMsg, setGpsMsg] = useState("");
  const [idle, setIdle] = useState("");
  const [lockedId, setLockedId] = useState("");

  const load = async (nextSort = sort) => {
    setError("");
    try {
      const [n, r] = await Promise.all([WorkerAPI.nearby(nextSort), WorkerAPI.recommended()]);
      setJobs(n.jobs);
      setGpsOk(n.gps);
      setAvailable(n.nextJobAvailable);
      setRemaining(n.remaining);
      setBest(r.best);
      setLockedId(n.activeJobId || "");
      if (n.message) setError(n.message);
      const idleState = await WorkerAPI.idleStatus().catch(() => null);
      if (idleState?.message) setIdle(idleState.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load jobs");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grabGps = async () => {
    setGpsMsg("");
    try {
      const pos = await readGps();
      const { user: next } = await AuthAPI.updateMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setUser(next);
      setGpsOk(true);
      await load();
    } catch {
      setGpsMsg("GPS unavailable. Showing jobs from your last saved location.");
    }
  };

  const accept = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      await RequestAPI.accept(id);
      setActiveRequestId(id);
      navigate("active-job");
    } catch (e) {
      setError(jobError(e));
      await load();
    } finally {
      setBusy("");
    }
  };

  const toggle = async () => {
    try {
      const r = await WorkerAPI.availability({ nextJobAvailable: !available });
      setAvailable(r.nextJobAvailable);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update availability");
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Dead time</p>
          <h1 className="font-display text-2xl font-bold text-slate-900">Find your next job</h1>
          <p className="text-sm text-slate-500 mt-1">
            {remaining > 0 ? `₹${remaining.toLocaleString("en-IN")} left on today's target.` : "Ranked by skill, distance, earning and urgency."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold ${available ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
        >
          {available ? "🟢 Available" : "⚪ Not available"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {idle && !lockedId && <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">{idle}</p>}
      {lockedId && (
        <Button fullWidth onClick={() => { setActiveRequestId(lockedId); navigate("active-job"); }}>
          Open active job
        </Button>
      )}
      {sort === "home" && user?.homeLat == null && (
        <Button variant="outline" fullWidth onClick={() => {
          void readGps().then((pos) => AuthAPI.updateMe({ homeLat: pos.coords.latitude, homeLng: pos.coords.longitude }).then((d) => setUser(d.user)));
        }}>
          Save current GPS as home
        </Button>
      )}
      {gpsMsg && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{gpsMsg}</p>}
      {!gpsOk && (
        <Button variant="outline" fullWidth onClick={() => void grabGps()}>
          <Navigation className="w-4 h-4" /> Use current GPS
        </Button>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setSort(f.id);
              void load(f.id);
            }}
            className={`shrink-0 px-3 py-2 rounded-full text-xs font-semibold ${
              sort === f.id ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {best && (
        <Card padding="md" className="border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1 mb-2">
            <Flame className="w-4 h-4" /> Best next job
          </p>
          <JobRow job={best} />
          <p className="text-xs text-amber-800 mt-2">This job can help you reach today's target faster.</p>
          <Button className="mt-3" fullWidth loading={busy === best.id} disabled={!!lockedId} onClick={() => void accept(best.id)}>
            Accept
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {jobs.filter((j) => j.id !== best?.id).map((job) => (
          <Card key={job.id} padding="md">
            <JobRow job={job} />
            <Button className="mt-3" fullWidth variant="outline" loading={busy === job.id} disabled={!!lockedId} onClick={() => void accept(job.id)}>
              Accept
            </Button>
          </Card>
        ))}
        {!jobs.length && (
          <EmptyState
            icon="📍"
            title="No nearby jobs"
            description={user?.provider?.available === false ? "Go online from your dashboard to see work." : "Check back soon, or widen your service area."}
          />
        )}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: WorkerJobCard }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">{job.category}</p>
          <p className="font-semibold text-slate-900 mt-0.5">{job.description || job.category}</p>
        </div>
        <p className="font-black text-slate-900">₹{job.amount}</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {job.distanceKm != null ? `${job.distanceKm} km` : job.area || job.city || "Nearby"}
        </span>
        {job.etaMinutes != null && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {job.etaMinutes} min
          </span>
        )}
        <span>⏱️ ~{job.durationHours || 1.5} hours</span>
        {job.urgent && <span className="text-red-600 font-semibold">Urgent</span>}
        {job.onWayHome && <span className="text-emerald-700 font-semibold">On your way home</span>}
      </div>
    </div>
  );
}
