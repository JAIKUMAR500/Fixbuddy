import React from "react";
import {
  Briefcase,
  Wrench,
  Calendar,
  DollarSign,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Plus,
} from "lucide-react";
import { View } from "../../types";
import { StatCard, Card, SectionHeader, Badge, RatingStars, Button } from "../../components/ui";
import { JobProgress } from "../../components/JobProgress";
import { useApp, useFetch } from "../../api/AppContext";
import { isSeeker } from "../../api/roles";
import { mediaUrl, WorkerAPI, type JobRequest } from "../../api/client";

export default function BusinessDashboard({ navigate }: { navigate: (v: View) => void }) {
  const { user, setActiveRequestId } = useApp();
  const worker = isSeeker(user?.role);
  const { data: statsData } = useFetch<{ stats: Record<string, number> }>("/stats");
  const { data: inbox } = useFetch<{ requests: JobRequest[] }>(worker ? "/requests?inbox=true" : "/requests");
  const stats = statsData?.stats || {};
  const list = inbox?.requests || [];
  const incoming = list.filter((r) => ["open", "requested", "matching"].includes(r.status) && (!worker || !r.providerId));
  const active = list.filter(
    (r) =>
      ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"].includes(r.status) ||
      (worker && r.status === "requested" && r.providerId === user?.id)
  );
  const current = active[0];

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-4 border-white shadow-lg bg-sky-100 flex-shrink-0 ring-2 ring-sky-100">
            {user?.avatar ? (
              <img src={mediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-sky-700">
                {(user?.provider?.businessName || user?.name || "U").slice(0, 1)}
              </div>
            )}
          </div>
          <div>
            <p className="text-slate-500 text-sm">Welcome back,</p>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {user?.provider?.businessName || user?.name || "Account"}
            </h1>
            {worker && <p className="text-xs text-brand mt-1">Job seeker · pick up live work</p>}
            {!worker && <p className="text-xs text-brand mt-1">Job creator · post work for workers</p>}
          </div>
        </div>
        {!worker && (
          <Button onClick={() => navigate("create-request")}>
            <Plus className="w-4 h-4" /> Post a Job
          </Button>
        )}
      </div>

      {current && (
        <Card padding="md" className="bg-navy text-white border-navy cursor-pointer" onClick={() => { setActiveRequestId(current.id); navigate("active-job"); }}>
          <p className="text-sky-200 text-xs font-semibold uppercase">Active job</p>
          <p className="font-semibold text-lg mt-1">{current.category}</p>
          <p className="text-sm text-slate-300">{current.status.replace(/_/g, " ")} · {current.area || current.city}</p>
          <p className="text-sm font-semibold text-sky-200 mt-2">Open active job</p>
        </Card>
      )}

      {worker && <WorkerPowerHome navigate={navigate} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={worker ? "New Jobs" : "Open Posts"}
          value={stats.newRequests ?? incoming.length}
          icon={<Briefcase className="w-5 h-5" />}
          color="sky"
        />
        <StatCard
          label="Active Jobs"
          value={stats.inProgress ?? active.length}
          icon={<Wrench className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          label="Upcoming"
          value={stats.upcoming ?? 0}
          icon={<Calendar className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          label="Completed"
          value={stats.completed ?? user?.provider?.completedJobs ?? 0}
          icon={<TrendingUp className="w-5 h-5" />}
          color="violet"
        />
      </div>

      <Card padding="md" className="bg-brand border-brand">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sky-200 text-xs font-medium">{worker ? "Today's Earnings" : "Spend on posted jobs"}</p>
            <p className="font-display text-3xl font-black text-white mt-0.5">₹{worker ? (stats.todayEarnings ?? 0) : (stats.spend ?? stats.earnings ?? 0)}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>
        <button onClick={() => navigate("earnings")} className="mt-3 text-xs font-semibold text-sky-200 flex items-center gap-1 hover:text-white transition-colors">
          View details <ArrowRight className="w-3 h-3" />
        </button>
      </Card>

      <div>
        <SectionHeader
          title={worker && active.length ? "Current job — finish this first" : worker ? "Available jobs" : "Jobs you posted"}
          actionLabel="View all"
          action={() => navigate(worker ? (current ? "active-job" : "work-requests") : "my-jobs")}
        />
        <div className="space-y-3">
          {(worker ? (active.length ? active : incoming) : list).slice(0, 4).map((req) => (
            <Card key={req.id} padding="md" className="hover:border-sky-300 hover:shadow-sm transition-all cursor-pointer" onClick={() => {
              setActiveRequestId(req.id);
              navigate(worker && active.some((a) => a.id === req.id) ? "active-job" : worker ? "work-requests" : "my-jobs");
            }}>
              {worker && active.some((a) => a.id === req.id) && (
                <div className="mb-4">
                  <JobProgress status={req.status} />
                </div>
              )}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm line-clamp-1">{req.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{req.category} · {req.postedByRole || "customer"}</p>
                </div>
                <Badge variant={active.some((a) => a.id === req.id) ? "success" : "info"} className="flex-shrink-0">{req.status.replace("_", " ")}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>📍 {req.area || req.city}</span>
                <span>🕐 {req.scheduledLabel || req.timing}</span>
                <span>💰 ₹{req.estimatedAmount}</span>
              </div>
            </Card>
          ))}
          {!list.length && <p className="text-sm text-slate-500">{worker ? "No open jobs right now." : "Post a job to hire workers."}</p>}
          {worker && active.length > 0 && incoming.length > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              {incoming.length} more job{incoming.length === 1 ? "" : "s"} hidden until you complete the current one.
            </p>
          )}
        </div>
      </div>

      {worker && (
        <div>
          <SectionHeader title="Upcoming Jobs" actionLabel="My Jobs" action={() => navigate("my-jobs")} />
          <div className="space-y-2">
            {active.map((job) => (
              <div key={job.id} className="bg-white rounded-xl border border-sky-100 px-4 py-3 flex items-center gap-3" onClick={() => navigate("my-jobs")}>
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{job.category}</p>
                  <p className="text-xs text-slate-500">{job.customer?.name || "Customer"} · {job.area || job.city}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {worker && (
        <Card padding="md" className="bg-amber-50 border-amber-200">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-black text-4xl text-amber-600">{user?.provider?.ratingAvg || 0}</p>
              <RatingStars value={user?.provider?.ratingAvg || 0} showCount={false} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">Your rating</p>
              <p className="text-xs text-slate-600 mt-0.5">Based on {user?.provider?.ratingCount || 0} reviews</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function WorkerPowerHome({ navigate }: { navigate: (v: View) => void }) {
  const { data } = useFetch<Awaited<ReturnType<typeof WorkerAPI.dashboard>>>("/worker/dashboard");
  const { setActiveRequestId } = useApp();
  if (!data) return null;
  const t = data.target;
  const pct = t?.percent || 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {data.greeting} · {data.nextJobAvailable ? "🟢 Available for next job" : "⚪ Not taking next jobs"}
        </p>
      </div>
      {data.festival && (
        <Card padding="md" className="bg-amber-50 border-amber-200">
          <p className="font-semibold text-amber-900">{data.festival.name}</p>
          <p className="text-sm text-amber-800 mt-1">{data.festival.note}</p>
        </Card>
      )}
      {data.activeJob && (
        <Card padding="md" className="bg-slate-900 text-white border-slate-900 cursor-pointer" onClick={() => { setActiveRequestId(data.activeJob!.id); navigate("active-job"); }}>
          <p className="text-xs text-sky-200 uppercase">Active job</p>
          <p className="font-semibold mt-1">{data.activeJob.category}</p>
          <p className="text-sm text-slate-300">{data.activeJob.status.replace(/_/g, " ")} · {data.activeJob.area}</p>
        </Card>
      )}
      <Card padding="md" className="cursor-pointer" onClick={() => navigate("worker-target")}>
        <p className="text-xs font-semibold text-slate-500 mb-1">Today's target</p>
        <p className="font-display text-2xl font-black text-slate-900">₹{(t?.amount || 0).toLocaleString("en-IN")}</p>
        <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          ₹{(t?.earned || 0).toLocaleString("en-IN")} earned · ₹{(t?.remaining || 0).toLocaleString("en-IN")} remaining · {pct}%
          {t?.achieved ? " · Target achieved" : ""}
        </p>
        <p className="text-xs text-slate-400 mt-1">{data.todayJobs} paid jobs today</p>
      </Card>
      {data.bestJob && !data.activeJob && (
        <Card padding="md" className="border-amber-200 bg-amber-50 cursor-pointer" onClick={() => navigate("worker-next-jobs")}>
          <p className="text-xs font-semibold text-amber-800 mb-1">🔥 Best next job</p>
          <p className="font-semibold text-slate-900">{data.bestJob.category} · ₹{data.bestJob.amount}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {data.bestJob.distanceKm != null ? `${data.bestJob.distanceKm} km` : "Nearby"} · ~{data.bestJob.durationHours || 1} hour
          </p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="md" className="cursor-pointer" onClick={() => navigate("worker-next-jobs")}>
          <p className="text-xs text-slate-500">📍 Nearby jobs</p>
          <p className="font-bold text-lg text-slate-900">{data.nearbyCount} available</p>
        </Card>
        <Card padding="md" className="cursor-pointer" onClick={() => navigate("worker-crews")}>
          <p className="text-xs text-slate-500">👥 My team</p>
          <p className="font-bold text-lg text-slate-900">
            {data.crew ? `${data.crew.members} members` : "Create"}
          </p>
          {data.crew && <p className="text-[11px] text-slate-500">{data.crew.name} · {data.crew.ratingAvg || "—"}★</p>}
        </Card>
        <Card padding="md" className="cursor-pointer" onClick={() => navigate("worker-passport")}>
          <p className="text-xs text-slate-500">🪪 Passport</p>
          <p className="font-bold text-lg text-slate-900">{data.passport.jobs} jobs</p>
          <p className="text-[11px] text-slate-500">{data.passport.verified ? "Verified ✓" : "Build your profile"} · {data.passport.ratingAvg}★</p>
        </Card>
        <Card padding="md" className="cursor-pointer border-red-100" onClick={() => navigate("worker-safety")}>
          <p className="text-xs text-slate-500">🛡️ Safety</p>
          <p className="font-bold text-lg text-red-600">Emergency</p>
        </Card>
      </div>
    </div>
  );
}
