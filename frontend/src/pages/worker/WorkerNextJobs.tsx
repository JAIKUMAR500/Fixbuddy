import React, { useEffect, useState } from "react";
import { MapPin, Clock, Flame, Navigation, Wrench, Bell, Layers, ShieldAlert } from "lucide-react";
import { View } from "../../types";
import { Button, Card, EmptyState } from "../../components/ui";
import { AuthAPI, CrewAPI, RequestAPI, WorkerAPI, type WorkerCrew, type WorkerJobCard } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { readGps } from "../../api/geo";
import { isWorkerBusyConflict, jobError } from "../../api/jobLock";
import JobDemandHeatmap from "../../components/JobDemandHeatmap";
import WorkerNotificationPreferencesModal from "../../components/WorkerNotificationPreferencesModal";

const FILTERS: { id: string; label: string }[] = [
  { id: "recommended", label: "Best nearby" },
  { id: "home", label: "On my way home" },
  { id: "nearest", label: "Nearest" },
  { id: "earning", label: "Highest earning" },
  { id: "urgent", label: "Urgent" },
];

export default function WorkerNextJobs({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId, setUser, user, refreshCurrentJob } = useApp();
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
  const [ledCrews, setLedCrews] = useState<WorkerCrew[]>([]);
  const [acceptFor, setAcceptFor] = useState<string | null>(null);
  const [pickCrew, setPickCrew] = useState<WorkerCrew | null>(null);
  const [hasSkills, setHasSkills] = useState(true);
  const [skills, setSkills] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");
  const [showPrefsModal, setShowPrefsModal] = useState(false);

  const load = async (nextSort = sort) => {
    setError("");
    try {
      const [n, r, crews] = await Promise.all([
        WorkerAPI.nearby(nextSort),
        WorkerAPI.recommended(),
        CrewAPI.mine().catch(() => ({ crews: [] as WorkerCrew[] })),
      ]);
      setJobs(n.jobs);
      setGpsOk(n.gps);
      setAvailable(n.nextJobAvailable);
      setRemaining(n.remaining);
      setBest(r.best);
      setLockedId(n.activeJobId || "");
      setHasSkills(n.hasSkills !== false);
      setSkills(n.skills || user?.provider?.skills?.map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean) || []);
      if (n.message) setError(n.message);
      setLedCrews(crews.crews.filter((c) => c.leaderId === user?.id && c.status === "active"));
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

  const hereCoords = () =>
    new Promise<{ lat?: number; lng?: number }>((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 8000 }
      );
    });

  const acceptSolo = async (id: string) => {
    setBusy(id);
    setError("");
    setAcceptFor(null);
    setPickCrew(null);
    try {
      await RequestAPI.accept(id, await hereCoords());
      setActiveRequestId(id);
      await refreshCurrentJob();
      navigate("active-job");
    } catch (e) {
      setError(jobError(e));
      if (isWorkerBusyConflict(e)) {
        await refreshCurrentJob();
        navigate("active-job");
      } else {
        await load();
      }
    } finally {
      setBusy("");
    }
  };

  const acceptCrew = async (jobId: string, crew: WorkerCrew) => {
    setBusy(jobId);
    setError("");
    setAcceptFor(null);
    setPickCrew(null);
    try {
      const memberIds = crew.members.filter((m) => m.status === "active").map((m) => m.userId);
      await CrewAPI.acceptJob(crew.id, jobId, memberIds);
      setActiveRequestId(jobId);
      await refreshCurrentJob();
      navigate("active-job");
    } catch (e) {
      setError(jobError(e));
      if (isWorkerBusyConflict(e)) {
        await refreshCurrentJob();
        navigate("active-job");
      } else {
        await load();
      }
    } finally {
      setBusy("");
    }
  };

  const beginAccept = (id: string) => {
    if (ledCrews.length) {
      setAcceptFor(id);
      setPickCrew(null);
      return;
    }
    void acceptSolo(id);
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

  const skillLabels =
    skills.length > 0
      ? skills
      : [user?.provider?.category, ...(user?.provider?.skills || []).map((s) => (typeof s === "string" ? s : s.name))]
          .filter(Boolean)
          .map(String);

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Your work</p>
          <h1 className="font-display text-2xl font-bold text-slate-900">Jobs for your skills</h1>
          <p className="text-sm text-slate-500 mt-1">
            {remaining > 0 ? `₹${remaining.toLocaleString("en-IN")} left on today's target.` : "Only open jobs matching your registered skills."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrefsModal(true)}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            title="Alert Preferences"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void toggle()}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold ${available ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
          >
            {available ? "Online" : "Offline"}
          </button>
        </div>
      </div>

      {/* View Mode Switch (List vs Local Demand Heatmap) */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Nearby Job Feed
        </button>
        <button
          type="button"
          onClick={() => setViewMode("heatmap")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            viewMode === "heatmap" ? "bg-white text-amber-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          Local Demand Heatmap
        </button>
      </div>

      {skillLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skillLabels.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand px-3 py-1.5 text-xs font-semibold">
              <Wrench className="w-3 h-3" /> {s}
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {idle && <p className="text-sm text-slate-600">{idle}</p>}
      {!gpsOk && (
        <Card padding="md" className="space-y-2">
          <p className="text-sm text-slate-700">Enable GPS for better job ranking.</p>
          <Button size="sm" onClick={() => void grabGps()}>
            <Navigation className="w-4 h-4" /> Use my location
          </Button>
          {gpsMsg && <p className="text-xs text-amber-700">{gpsMsg}</p>}
        </Card>
      )}

      {!hasSkills && (
        <Card padding="lg" className="space-y-3 border-amber-200 bg-amber-50 text-center">
          <p className="font-display text-xl font-bold text-navy">Complete Your Worker Profile</p>
          <p className="text-sm text-slate-600">Add your service skills to start receiving relevant jobs.</p>
          <Button fullWidth onClick={() => navigate("worker-passport")}>
            Update Skills
          </Button>
        </Card>
      )}

      {acceptFor && !pickCrew && (
        <Card padding="md" className="space-y-3 border-sky-200 bg-sky-50">
          <p className="font-semibold text-slate-900">How will you work on this job?</p>
          <Button fullWidth onClick={() => void acceptSolo(acceptFor)}>
            Myself
          </Button>
          <Button fullWidth variant="outline" onClick={() => setPickCrew(ledCrews[0] || null)}>
            My Crew
          </Button>
          <Button fullWidth variant="ghost" onClick={() => setAcceptFor(null)}>
            Cancel
          </Button>
        </Card>
      )}

      {acceptFor && pickCrew && (
        <Card padding="md" className="space-y-3 border-sky-200">
          <p className="font-semibold text-slate-900">Select crew</p>
          {ledCrews.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`w-full text-left rounded-xl border px-3 py-3 ${pickCrew.id === c.id ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}
              onClick={() => setPickCrew(c)}
            >
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.members
                  .filter((m) => m.status === "active")
                  .map((m) => `${m.name}${m.role === "leader" ? " — Lead" : ""}`)
                  .join(" · ")}
              </p>
            </button>
          ))}
          <p className="text-xs text-slate-500">Crew lead controls the job lifecycle. One acceptance locks the Request.</p>
          <Button fullWidth loading={busy === acceptFor} onClick={() => void acceptCrew(acceptFor, pickCrew)}>
            Confirm crew assignment
          </Button>
          <Button fullWidth variant="ghost" onClick={() => setPickCrew(null)}>
            Back
          </Button>
        </Card>
      )}

      {viewMode === "heatmap" ? (
        <JobDemandHeatmap workerLat={user?.lat} workerLng={user?.lng} />
      ) : (
        <>
          {hasSkills && (
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
      )}

      {hasSkills && best && (
        <Card padding="md" className="border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1 mb-2">
            <Flame className="w-4 h-4" /> Best next job
          </p>
          <JobRow job={best} />
          <p className="text-xs text-amber-800 mt-2">This job can help you reach today's target faster.</p>
          <Button className="mt-3" fullWidth loading={busy === best.id} disabled={!!lockedId} onClick={() => beginAccept(best.id)}>
            Accept
          </Button>
        </Card>
      )}

      {hasSkills && (
        <div className="space-y-3">
          {jobs
            .filter((j) => j.id !== best?.id)
            .map((job) => (
              <Card key={job.id} padding="md">
                <JobRow job={job} />
                <Button className="mt-3" fullWidth variant="outline" loading={busy === job.id} disabled={!!lockedId} onClick={() => beginAccept(job.id)}>
                  Accept
                </Button>
              </Card>
            ))}
          {!jobs.length && !error && (
            <EmptyState
              icon="🔧"
              title="No matching jobs nearby"
              description="There are currently no open jobs matching your skills. We'll show relevant work here when it becomes available."
            />
          )}
          {!jobs.length && !error && (
            <Button fullWidth variant="outline" onClick={() => navigate("worker-passport")}>
              Update Skills
            </Button>
          )}
        </div>
      )}
        </>
      )}

      {showPrefsModal && (
        <WorkerNotificationPreferencesModal
          onClose={() => setShowPrefsModal(false)}
        />
      )}
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
        <span>~{job.durationHours || 1.5} hours</span>
        {(job.urgent || (job as any).priority === "emergency") && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> {(job as any).priority === "emergency" ? "Emergency" : "Urgent"}
          </span>
        )}
        {job.onWayHome && <span className="text-emerald-700 font-semibold">On your way home</span>}
      </div>
    </div>
  );
}
