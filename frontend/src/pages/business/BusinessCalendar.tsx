import React, { useMemo, useState } from "react";
import { View } from "../../types";
import { Card, Badge, EmptyState } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import type { JobRequest } from "../../api/client";

const VIEWS = ["Day", "Week", "Month"] as const;
type CalView = typeof VIEWS[number];

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function labelFor(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function BusinessCalendar({ navigate }: { navigate: (v: View) => void }) {
  const [calView, setCalView] = useState<CalView>("Week");
  const { setActiveRequestId } = useApp();
  const { data, loading, error } = useFetch<{ requests: JobRequest[] }>("/requests");
  const jobs = data?.requests || [];

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const count = calView === "Day" ? 1 : calView === "Week" ? 7 : 30;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return dayKey(d);
    });
  }, [calView]);

  const [selectedDay, setSelectedDay] = useState(days[0]);
  const activeDay = days.includes(selectedDay) ? selectedDay : days[0];

  const jobsOn = (iso: string) =>
    jobs.filter((r) => {
      const stamp = r.scheduledAt || r.createdAt;
      return stamp && dayKey(new Date(stamp)) === iso;
    });

  const dayJobs = jobsOn(activeDay);

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>Calendar</h1>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex gap-1 bg-sky-50 p-1 rounded-xl">
          {VIEWS.map((v) => (
            <button key={v} onClick={() => setCalView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${calView === v ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{v}</button>
          ))}
        </div>
      </div>

      {error && <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}
      {loading && <Card className="text-sm text-slate-500">Loading jobs...</Card>}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {days.map((iso) => {
          const d = new Date(`${iso}T12:00:00`);
          const active = iso === activeDay;
          const count = jobsOn(iso).length;
          return (
            <button
              key={iso}
              onClick={() => setSelectedDay(iso)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-3 rounded-2xl min-w-[64px] transition-all ${active ? "bg-sky-600 text-white shadow-md" : "bg-white border border-sky-100 text-slate-600 hover:border-sky-300"}`}
            >
              <span className={`text-xs font-medium ${active ? "text-sky-200" : "text-slate-400"}`}>{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
              <span className={`text-xl font-bold ${active ? "text-white" : "text-slate-800"}`} style={{ fontFamily: "Outfit, sans-serif" }}>{d.getDate()}</span>
              {count > 0 && (
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? "bg-white text-sky-600" : "bg-sky-100 text-sky-600"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="font-semibold text-slate-900 mb-3">{labelFor(activeDay)}</h2>
        {dayJobs.length === 0 ? (
          <EmptyState icon="📅" title="No jobs scheduled" description="Jobs assigned to this day will show up here." />
        ) : (
          <div className="space-y-3">
            {dayJobs.map((job) => (
              <Card key={job.id} padding="md" className="flex gap-4 items-center hover:border-sky-300 transition-all cursor-pointer" onClick={() => { setActiveRequestId(job.id); navigate("job-details"); }}>
                <div className="flex-shrink-0 text-center">
                  <p className="text-xs text-slate-400">Time</p>
                  <p className="font-bold text-sky-700 text-sm whitespace-nowrap">
                    {job.scheduledAt ? new Date(job.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : job.timing}
                  </p>
                </div>
                <div className="w-px h-10 bg-sky-100 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{job.category}</p>
                  <p className="text-xs text-slate-500">{job.customer?.name || job.provider?.name || "Open request"}</p>
                </div>
                <Badge variant={job.status === "scheduled" ? "warning" : "success"}>{job.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-slate-900 mb-3">All Upcoming Jobs</h2>
        <div className="space-y-2">
          {jobs.filter((j) => ["accepted", "scheduled", "in_progress"].includes(j.status)).map((job) => (
            <div key={job.id} className="flex items-center gap-3 bg-white rounded-xl border border-sky-100 px-4 py-3 hover:border-sky-300 transition-all cursor-pointer" onClick={() => { setActiveRequestId(job.id); navigate("job-details"); }}>
              <div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{job.category}</p>
                <p className="text-xs text-slate-500">{job.customer?.name || job.provider?.name || job.area}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-700">{job.scheduledLabel || job.timing}</p>
                <p className="text-xs text-sky-600">{job.status}</p>
              </div>
            </div>
          ))}
          {!jobs.some((j) => ["accepted", "scheduled", "in_progress"].includes(j.status)) && (
            <p className="text-sm text-slate-500">No upcoming jobs yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
