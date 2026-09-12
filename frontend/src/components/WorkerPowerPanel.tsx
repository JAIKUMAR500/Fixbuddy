import React from "react";
import { MapPin, ShieldAlert, Target, UserRound } from "lucide-react";
import { Button, Card } from "./ui";
import { useApp, useFetch } from "../api/AppContext";
import { WorkerAPI, type WorkerJobSuggestion, type WorkerPassport, type WorkerTarget } from "../api/client";
import type { View } from "../types";

export default function WorkerPowerPanel({ navigate }: { navigate: (view: View) => void }) {
  const { setActiveRequestId } = useApp();
  const { data: targetData, reload: reloadTarget } = useFetch<{ target: WorkerTarget }>("/worker/daily-target");
  const { data: jobsData } = useFetch<{ jobs: WorkerJobSuggestion[] }>("/worker/recommended-jobs");
  const { data: passportData } = useFetch<{ passport: WorkerPassport }>("/worker/passport");
  const [amount, setAmount] = React.useState(1500);
  const [editing, setEditing] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const target = targetData?.target;
  const bestJob = jobsData?.jobs?.[0];
  const passport = passportData?.passport;

  React.useEffect(() => {
    if (target?.amount != null) setAmount(target.amount);
  }, [target?.amount]);

  const saveTarget = async () => {
    try {
      await WorkerAPI.saveTarget(amount);
      setEditing(false);
      reloadTarget();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save target");
    }
  };

  const safety = async () => {
    try {
      await WorkerAPI.safety({ type: "emergency", description: "Worker requested emergency assistance" });
      setMessage("Safety assistance has been requested. Move to a safe place and call emergency services if needed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send safety alert");
    }
  };

  return (
    <section className="space-y-4">
      {message && <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">{message}</Card>}
      <Card padding="md" className="border-sky-200 bg-sky-50">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-sky-700 flex items-center gap-2"><Target className="w-4 h-4" /> Today's income target</p><p className="mt-2 text-2xl font-black text-slate-900">₹{(target?.amount || 1500).toLocaleString("en-IN")}</p><p className="text-sm text-slate-600">₹{(target?.earned || 0).toLocaleString("en-IN")} earned · ₹{(target?.remaining || 0).toLocaleString("en-IN")} remaining</p></div>
          <button type="button" className="text-sm font-semibold text-sky-700" onClick={() => setEditing((value) => !value)}>{editing ? "Close" : "Edit"}</button>
        </div>
        <div className="mt-4 h-3 rounded-full bg-white overflow-hidden"><div className="h-full rounded-full bg-sky-600" style={{ width: `${target?.percent || 0}%` }} /></div>
        {editing && <div className="mt-4 flex gap-2"><input type="number" min="0" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="min-w-0 flex-1 rounded-xl border border-sky-200 px-3 py-2" /><Button size="sm" onClick={() => void saveTarget()}>Save</Button></div>}
        {target?.achieved && <p className="mt-3 text-sm font-semibold text-emerald-700">Daily target achieved.</p>}
      </Card>

      {bestJob && <Card padding="md" className="border-emerald-200 bg-emerald-50"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Best next job</p><div className="mt-2 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{bestJob.category}</h2><p className="text-sm text-slate-600 line-clamp-1">{bestJob.description}</p><p className="mt-2 text-sm font-semibold text-emerald-800">₹{bestJob.amount} · {bestJob.distanceKm ?? "—"} km · {bestJob.etaMinutes ?? "—"} min</p></div><Button size="sm" onClick={() => { setActiveRequestId(bestJob.id); navigate("job-details"); }}>View job</Button></div></Card>}

      {passport && <Card padding="md"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2"><UserRound className="w-4 h-4" /> Professional passport</p><h2 className="mt-1 text-lg font-bold text-slate-900">{passport.name}</h2><p className="text-sm text-slate-600">{passport.skills.slice(0, 3).map((skill) => skill.name).join(" · ") || "Add skills to your passport"}</p></div><div className="text-right"><p className="text-xl font-black text-slate-900">{passport.ratingAvg.toFixed(1)}</p><p className="text-xs text-slate-500">{passport.completedJobs} completed</p></div></div></Card>}

      <Button variant="danger" size="sm" onClick={() => void safety()}><ShieldAlert className="w-4 h-4" /> Safety assistance</Button>
      {bestJob?.distanceKm != null && <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Recommendations use your current saved location and skills.</p>}
    </section>
  );
}
