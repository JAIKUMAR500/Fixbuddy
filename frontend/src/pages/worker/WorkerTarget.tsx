import React, { useEffect, useState } from "react";
import { Target, CheckCircle } from "lucide-react";
import { View } from "../../types";
import { Button, Card, Input } from "../../components/ui";
import { WorkerAPI, type WorkerTarget } from "../../api/client";

const PRESETS = [500, 750, 1000, 1500, 2000];

export default function WorkerTarget({ navigate }: { navigate: (v: View) => void }) {
  const [target, setTarget] = useState<WorkerTarget | null>(null);
  const [custom, setCustom] = useState("");
  const [history, setHistory] = useState<Record<string, { amount: number; jobs: number }>>({});
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [t, h] = await Promise.all([WorkerAPI.getTarget(), WorkerAPI.history()]);
      setTarget(t.target);
      setHistory(h.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load target");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (amount: number) => {
    if (!Number.isFinite(amount) || amount < 100 || amount > 100000) {
      setMsg("");
      setError("Enter at least ₹100. Presets: ₹500, ₹750, ₹1,000, ₹1,500, ₹2,000 — or type a custom amount.");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await WorkerAPI.setTarget(amount);
      setTarget(r.target);
      setCustom("");
      setMsg(`Today's target set to ₹${amount.toLocaleString("en-IN")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const pct = target?.percent || 0;
  const amount = target?.amount || 0;
  const earned = target?.earned || 0;
  const remaining = target?.remaining || 0;

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Worker power</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">Daily income target</h1>
        <p className="text-sm text-slate-500 mt-1">Only paid completed jobs count. Cancelled or unpaid work is ignored.</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{msg}</p>}

      <div className="rounded-2xl bg-navy text-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-sky-200" />
          </span>
          <p className="text-sky-100 text-sm font-medium">Today's income target</p>
        </div>
        <p className="font-display text-4xl font-black tracking-tight">
          {loading && !target ? "—" : `₹${amount.toLocaleString("en-IN")}`}
        </p>
        <div className="mt-4 h-3 bg-white/15 rounded-full overflow-hidden">
          <div className="h-full bg-sky-400 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-white/10 px-3 py-2.5">
            <p className="text-sky-200">Earned</p>
            <p className="font-bold text-base mt-0.5">₹{earned.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2.5">
            <p className="text-sky-200">Remaining</p>
            <p className="font-bold text-base mt-0.5">₹{remaining.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2.5">
            <p className="text-sky-200">Progress</p>
            <p className="font-bold text-base mt-0.5">{pct}%</p>
          </div>
        </div>
        {target?.achieved && (
          <p className="mt-4 text-sm bg-emerald-500/20 text-emerald-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Daily target achieved. You can keep earning.
          </p>
        )}
      </div>

      <Card padding="md" className="space-y-3">
        <p className="font-semibold text-slate-900">Set today's target</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => void save(n)}
              className={`min-h-11 rounded-xl border text-sm font-semibold ${
                target?.amount === n ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              ₹{n.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <Input
            label="Custom amount (₹100+)"
            type="number"
            min={100}
            step={50}
            placeholder="e.g. 1200"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <Button
            className="mb-0.5"
            disabled={busy || !custom.trim()}
            onClick={() => void save(Number(custom))}
          >
            Save
          </Button>
        </div>
      </Card>

      <Card padding="md">
        <p className="font-semibold text-slate-900 mb-3">History</p>
        <div className="space-y-2">
          {(["today", "yesterday", "week", "month"] as const).map((key) => {
            const row = history[key];
            const labels = { today: "Today", yesterday: "Yesterday", week: "This week", month: "This month" };
            return (
              <div key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-sm text-slate-600">{labels[key]}</p>
                <p className="text-sm font-semibold text-slate-900">
                  ₹{(row?.amount || 0).toLocaleString("en-IN")}
                  <span className="text-slate-400 font-normal"> · {row?.jobs || 0} jobs</span>
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Button fullWidth onClick={() => navigate("worker-next-jobs")}>
        Find jobs to hit the target
      </Button>
    </div>
  );
}
