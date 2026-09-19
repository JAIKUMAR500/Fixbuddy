import React from "react";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  ChevronRight,
  Compass,
  IdCard,
  MapPin,
  Plus,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { View } from "../../types";
import { Button, Card, FetchBanner, RatingStars, StatusBadge } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { isSeeker } from "../../api/roles";
import { mediaUrl, WorkerAPI, type JobRequest } from "../../api/client";
import { statusLabel } from "../../api/jobLock";

const ASSIGNED = ["accepted", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"];
const OPEN = ["open", "requested", "matching"];

export default function BusinessDashboard({ navigate }: { navigate: (v: View) => void }) {
  const { user, jobFocusLocked, currentJob, openRequest } = useApp();
  const worker = isSeeker(user?.role);
  const { data: statsData, error: statsError, reload: reloadStats } = useFetch<{ stats: Record<string, number> }>("/stats");
  const { data: inbox, error: inboxError, reload: reloadInbox } = useFetch<{ requests: JobRequest[] }>(worker ? "/requests?inbox=true" : "/requests");
  const stats = statsData?.stats || {};
  const list = inbox?.requests || [];
  const incoming = list.filter((r) => OPEN.includes(r.status) && (!worker || !r.providerId));
  const assigned = list.filter((r) => ASSIGNED.includes(r.status));
  const upcoming = list.filter((r) => r.status === "scheduled");
  const current = assigned[0];

  const openJob = (req: JobRequest) => {
    if (currentJob && req.id === currentJob.id) {
      openRequest(req.id, "active-job");
      return;
    }
    openRequest(req.id, worker && ASSIGNED.includes(req.status) ? "active-job" : worker ? "job-details" : "request-status");
  };

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-8 animate-fade-in">
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-brand-soft border border-brand/20 shrink-0">
              {user?.avatar ? (
                <img src={mediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-2xl font-bold text-brand">
                  {(user?.provider?.businessName || user?.name || "U").slice(0, 1)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {worker ? "Worker dashboard" : "Business dashboard"}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy truncate">
                {user?.provider?.businessName || user?.name || "Account"}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {worker ? "Pick up live work nearby" : "Post work and track your jobs"}
              </p>
            </div>
          </div>
          {!worker && !jobFocusLocked && (
            <Button onClick={() => navigate("create-request")}>
              <Plus className="w-4 h-4" /> Post a Job
            </Button>
          )}
          {!worker && jobFocusLocked && (
            <Button onClick={() => currentJob && openRequest(currentJob.id, "active-job")}>Track Active Job</Button>
          )}
        </header>
        <FetchBanner error={statsError || inboxError} onRetry={() => { reloadStats(); reloadInbox(); }} />

        {worker && <WorkerPowerHome navigate={navigate} />}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat
            label={worker ? "New jobs" : "Open posts"}
            value={stats.newRequests ?? incoming.length}
            icon={<Briefcase className="w-4 h-4" />}
            tone="brand"
          />
          <MiniStat
            label="Active"
            value={stats.inProgress ?? assigned.length}
            icon={<Wrench className="w-4 h-4" />}
            tone="emerald"
          />
          <MiniStat
            label="Upcoming"
            value={stats.upcoming ?? upcoming.length}
            icon={<Calendar className="w-4 h-4" />}
            tone="amber"
          />
          <MiniStat
            label="Completed"
            value={stats.completed ?? user?.provider?.completedJobs ?? 0}
            icon={<TrendingUp className="w-4 h-4" />}
            tone="violet"
          />
        </div>

        <button
          type="button"
          onClick={() => navigate("earnings")}
          className="w-full rounded-2xl bg-navy text-white px-5 py-4 flex items-center justify-between gap-3 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
              {worker ? "Today's earnings" : "Spend on posted jobs"}
            </p>
            <p className="font-display text-3xl font-black mt-1">
              ₹{worker ? stats.todayEarnings ?? 0 : stats.spend ?? stats.earnings ?? 0}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-sky-200">
            Details <ArrowRight className="w-4 h-4" />
          </span>
        </button>
        <JobSection
          title={worker ? "Assigned jobs" : "Jobs you posted"}
          actionLabel="View all"
          onAction={() => navigate(worker ? (current ? "active-job" : "work-requests") : "my-jobs")}
          empty={worker ? "No assigned job right now. Check available work nearby." : "Post a job to hire workers."}
        >
          {(worker ? assigned : list).slice(0, 4).map((req) => (
            <DashboardJobCard key={req.id} req={req} onOpen={() => openJob(req)} />
          ))}
          {worker && assigned.length > 0 && incoming.length > 0 && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              {incoming.length} more nearby job{incoming.length === 1 ? "" : "s"} wait until you finish this one.
            </p>
          )}
        </JobSection>

        {worker && (
          <JobSection title="Upcoming jobs" actionLabel="My jobs" onAction={() => navigate("my-jobs")} empty="No scheduled jobs yet.">
            {upcoming.map((job) => (
              <DashboardJobCard key={job.id} req={job} tone="amber" onOpen={() => openJob(job)} />
            ))}
          </JobSection>
        )}

        {worker && (
          <Card padding="md" className="flex items-center gap-4">
            <div className="text-center min-w-16">
              <p className="font-display text-4xl font-black text-navy">{user?.provider?.ratingAvg || 0}</p>
              <RatingStars value={user?.provider?.ratingAvg || 0} showCount={false} />
            </div>
            <div>
              <p className="font-display font-bold text-slate-900">Your rating</p>
              <p className="text-sm text-slate-500 mt-0.5">Based on {user?.provider?.ratingCount || 0} reviews</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function JobSection({
  title,
  actionLabel,
  onAction,
  empty,
  children,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  empty: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-navy">{title}</h2>
        <button type="button" onClick={onAction} className="text-sm font-semibold text-brand">
          {actionLabel}
        </button>
      </div>
      <div className="space-y-3">
        {items.length ? items : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

function DashboardJobCard({
  req,
  tone = "brand",
  onOpen,
}: {
  req: JobRequest;
  tone?: "brand" | "amber";
  onOpen: () => void;
}) {
  const pay = req.workerQuote || req.estimatedAmount || 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl bg-white border border-slate-200 overflow-hidden hover:border-brand hover:shadow-md transition-all"
    >
      <div className="flex">
        <div className={`w-1.5 shrink-0 ${tone === "amber" ? "bg-amber-400" : "bg-brand"}`} />
        <div className="flex-1 p-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-bold text-navy">{req.category}</p>
              <StatusBadge status={req.status} />
            </div>
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{req.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-brand" /> {req.area || req.city}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-amber-600" /> {req.scheduledLabel || req.timing}
              </span>
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 sm:min-w-28">
            <p className="font-display text-2xl font-black text-brand">{pay ? `₹${pay}` : "Quote"}</p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
              Open <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function MiniStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "brand" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      <p className="font-display text-2xl font-black text-navy mt-3">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
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
      {data.festival && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="font-display font-bold text-amber-900">{data.festival.name}</p>
          <p className="text-sm text-amber-800 mt-0.5">{data.festival.note}</p>
        </div>
      )}
      {(data.skills?.length || 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.skills!.map((s) => (
            <span key={s} className="rounded-full bg-brand-soft text-brand px-3 py-1 text-xs font-semibold">
              {s}
            </span>
          ))}
        </div>
      )}
      {data.hasSkills === false && !data.activeJob && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-2">
          <p className="font-display text-lg font-bold text-navy">Complete Your Worker Profile</p>
          <p className="text-sm text-slate-600">Add your service skills to start receiving relevant jobs.</p>
          <Button size="sm" onClick={() => navigate("worker-passport")}>
            Update Skills
          </Button>
        </div>
      )}
      {data.activeJob && (
        <button
          type="button"
          className="w-full rounded-2xl bg-brand text-white px-5 py-4 text-left"
          onClick={() => {
            setActiveRequestId(data.activeJob!.id);
            navigate("active-job");
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">Active job</p>
          <p className="font-display text-xl font-bold mt-1">{data.activeJob.category}</p>
          <p className="text-sm text-sky-100 mt-0.5">
            {statusLabel(data.activeJob.status)} · {data.activeJob.area}
          </p>
        </button>
      )}
      <button type="button" className="w-full rounded-2xl bg-white border border-slate-200 p-5 text-left" onClick={() => navigate("worker-target")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-brand" /> Today's target
            </p>
            <p className="font-display text-3xl font-black text-navy mt-1">₹{(t?.amount || 0).toLocaleString("en-IN")}</p>
          </div>
          <p className="text-sm font-bold text-brand">{pct}%</p>
        </div>
        <div className="mt-3 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="text-sm text-slate-500 mt-2">
          ₹{(t?.earned || 0).toLocaleString("en-IN")} earned · ₹{(t?.remaining || 0).toLocaleString("en-IN")} left
          {t?.achieved ? " · Target done" : ""}
        </p>
      </button>
      {data.bestJob && !data.activeJob && (
        <button
          type="button"
          className="w-full rounded-2xl bg-amber-50 border border-amber-200 p-4 text-left"
          onClick={() => navigate("worker-next-jobs")}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">Best next job</p>
          <p className="font-display text-lg font-bold text-navy mt-1">
            {data.bestJob.category} · ₹{data.bestJob.amount}
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            {data.bestJob.distanceKm != null ? `${data.bestJob.distanceKm} km` : "Nearby"} · ~{data.bestJob.durationHours || 1} hour
          </p>
        </button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <QuickTile
          icon={<Compass className="w-5 h-5" />}
          label="Nearby jobs"
          value={`${data.nearbyCount} available`}
          tone="brand"
          onClick={() => navigate("worker-next-jobs")}
        />
        <QuickTile
          icon={<Users className="w-5 h-5" />}
          label="Crew"
          value={data.crew ? `${data.crew.members} members` : "Create"}
          tone="emerald"
          onClick={() => navigate("worker-crews")}
        />
        <QuickTile
          icon={<IdCard className="w-5 h-5" />}
          label="Passport"
          value={`${data.passport.jobs} jobs`}
          tone="violet"
          onClick={() => navigate("worker-passport")}
        />
        <QuickTile
          icon={<ShieldAlert className="w-5 h-5" />}
          label="Safety"
          value="Emergency"
          tone="rose"
          onClick={() => navigate("worker-safety")}
        />
      </div>
    </div>
  );
}

function QuickTile({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "brand" | "emerald" | "violet" | "rose";
  onClick: () => void;
}) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-red-50 text-red-600",
  };
  return (
    <button type="button" onClick={onClick} className="rounded-2xl bg-white border border-slate-200 p-4 text-left hover:border-brand/40 hover:shadow-sm">
      <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${tones[tone]}`}>{icon}</span>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-3">{label}</p>
      <p className="font-display font-bold text-navy mt-0.5">{value}</p>
    </button>
  );
}
