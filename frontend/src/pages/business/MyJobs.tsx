import React, { useMemo, useState } from "react";
import { Calendar, ChevronRight, MapPin, Plus, Wrench } from "lucide-react";
import { View } from "../../types";
import { Avatar, Card, EmptyState, Skeleton, StatusBadge } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import type { JobRequest } from "../../api/client";
import { isEngagedStatus, statusLabel } from "../../api/jobLock";
import { isSeeker } from "../../api/roles";

const TABS = ["All", "New", "Accepted", "Upcoming", "In Progress", "Completed", "Cancelled"] as const;
type Tab = (typeof TABS)[number];

const TAB_STATUSES: Record<Exclude<Tab, "All">, string[]> = {
  New: ["matching", "open", "requested"],
  Accepted: ["accepted"],
  Upcoming: ["scheduled"],
  "In Progress": ["on_the_way", "arrived", "otp_verified", "in_progress"],
  Completed: ["completed", "payment_collected", "customer_completed", "reviewed"],
  Cancelled: ["cancelled", "declined"],
};

const TAB_TONE: Record<Exclude<Tab, "All">, string> = {
  New: "bg-sky-50 text-sky-700",
  Accepted: "bg-blue-50 text-brand",
  Upcoming: "bg-amber-50 text-amber-700",
  "In Progress": "bg-indigo-50 text-indigo-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-slate-100 text-slate-600",
};

function matchesTab(status: string, tab: Tab) {
  if (tab === "All") return true;
  return TAB_STATUSES[tab].includes(status);
}

function JobCardSkeleton() {
  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-11 h-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex justify-between pt-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}

export default function MyJobs({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId, user, currentJob } = useApp();
  const [tab, setTab] = useState<Tab>("All");
  const { data, loading, error } = useFetch<{ requests: JobRequest[] }>("/requests");
  const worker = isSeeker(user?.role);
  const rows = data?.requests || [];
  const focusLocked = Boolean(currentJob && isEngagedStatus(currentJob.status));

  const counts = useMemo(() => {
    const next: Record<Exclude<Tab, "All">, number> = {
      New: 0,
      Accepted: 0,
      Upcoming: 0,
      "In Progress": 0,
      Completed: 0,
      Cancelled: 0,
    };
    for (const job of rows) {
      (Object.keys(TAB_STATUSES) as Exclude<Tab, "All">[]).forEach((key) => {
        if (TAB_STATUSES[key].includes(job.status)) next[key] += 1;
      });
    }
    return next;
  }, [rows]);

  const filtered = rows.filter((job) => matchesTab(job.status, tab));

  const openJob = (job: JobRequest) => {
    if (focusLocked && currentJob && job.id !== currentJob.id) {
      setActiveRequestId(currentJob.id);
      navigate("active-job");
      return;
    }
    setActiveRequestId(job.id);
    navigate(isEngagedStatus(job.status) ? "active-job" : worker ? "job-details" : "request-status");
  };

  const primaryAction = focusLocked
    ? { label: "Track Active Job", view: "active-job" as View }
    : worker
      ? { label: "Available Jobs", view: "work-requests" as View }
      : { label: "Post a Job", view: "create-request" as View };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-24 lg:pb-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">
            {worker ? "Worker workspace" : "Business workspace"}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mb-1">My Jobs</h1>
          <p className="text-slate-500 text-sm">
            {worker ? "Track accepted work from pickup through payment." : "Manage every job you posted, from matching to completion."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(primaryAction.view)}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-brand text-white text-sm font-semibold shadow-sm hover:bg-brand-dark"
        >
          {!worker && !focusLocked && <Plus className="w-4 h-4" />}
          {primaryAction.label}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {(Object.keys(TAB_STATUSES) as Exclude<Tab, "All">[]).map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(label)}
            className={`rounded-2xl border bg-white p-3 text-left transition-all ${
              tab === label ? "border-brand ring-2 ring-brand/15" : "border-slate-200 hover:border-brand/30"
            }`}
          >
            <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${TAB_TONE[label]}`}>{label}</span>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{counts[label]}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
        {TABS.map((item) => {
          const count = item === "All" ? rows.length : counts[item];
          const active = tab === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`flex-shrink-0 inline-flex items-center gap-2 min-h-10 px-3.5 rounded-full text-xs font-semibold border transition-all ${
                active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {item}
              <span className={`tabular-nums rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && <Card className="mb-4 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}

      {loading ? (
        <div className="space-y-3">
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === "Cancelled" ? "🚫" : "🔧"}
          title={tab === "All" ? "No jobs yet" : `No ${tab} jobs`}
          description={
            worker
              ? tab === "All"
                ? "Jobs you accept will show up here."
                : `You have no ${tab.toLowerCase()} jobs yet.`
              : tab === "All"
                ? "Post a job and workers nearby can pick it up."
                : `You have no ${tab.toLowerCase()} jobs.`
          }
          actionLabel={primaryAction.label}
          onAction={() => navigate(primaryAction.view)}
        />
      ) : (
        <div className="space-y-3 animate-slide-up">
          {filtered.map((job) => {
            const counterpart = worker ? job.customer : job.provider;
            const active = currentJob?.id === job.id && isEngagedStatus(job.status);
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => openJob(job)}
                className={`w-full text-left rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
                  active ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200 hover:border-brand/40"
                }`}
              >
                {active && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand mb-3">Active now</p>
                )}
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative shrink-0">
                    {counterpart?.avatar || counterpart?.name ? (
                      <Avatar src={counterpart?.avatar} name={counterpart?.name || (worker ? "Customer" : "Worker")} size="md" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center">
                        <Wrench className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm truncate">{job.category}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {job.code} · {counterpart?.name || (worker ? "Customer" : "Finding a worker")}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{statusLabel(job.status)}</p>
                  </div>
                </div>
                {job.description && (
                  <p className="text-sm text-slate-600 line-clamp-2 mb-3">{job.description}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 mb-3">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {job.area || job.city || "Location pending"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {job.scheduledLabel || job.timing || "ASAP"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="font-semibold text-slate-900 text-sm">
                    {job.estimatedAmount ? `₹${job.estimatedAmount}` : "Quote pending"}
                  </span>
                  <span className="text-xs text-brand font-medium inline-flex items-center gap-1">
                    {active ? "Continue job" : "View details"}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
