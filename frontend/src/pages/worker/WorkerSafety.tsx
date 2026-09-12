import React, { useEffect, useState } from "react";
import { ShieldAlert, MapPin, Phone, LifeBuoy, Flag, Pause } from "lucide-react";
import { View } from "../../types";
import { Button, Card, Textarea } from "../../components/ui";
import { SafetyAPI, RequestAPI } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { readGps } from "../../api/geo";

const ACTIONS = [
  { type: "share_location", label: "Share live location", icon: MapPin },
  { type: "call_contact", label: "Call emergency contact", icon: Phone },
  { type: "support", label: "Contact FixBuddy support", icon: LifeBuoy },
  { type: "report_customer", label: "Report customer", icon: Flag },
  { type: "pause_job", label: "Pause job", icon: Pause },
];

export default function WorkerSafety({ navigate }: { navigate: (v: View) => void }) {
  const { activeRequestId } = useApp();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [jobId, setJobId] = useState(activeRequestId || "");

  useEffect(() => {
    if (activeRequestId) setJobId(activeRequestId);
    else {
      void RequestAPI.active()
        .then((d) => setJobId(d.request?.id || ""))
        .catch(() => setJobId(""));
    }
  }, [activeRequestId]);

  const run = async (type: string) => {
    setBusy(type);
    setError("");
    setMsg("");
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await readGps();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        /* location optional */
      }
      await SafetyAPI.create({ type, description: note, requestId: jobId || undefined, lat, lng });
      setMsg("Safety incident recorded. FixBuddy support has been notified.");
      if (type === "call_contact") window.location.href = "tel:112";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit. Try again.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Protection</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">Emergency assistance</h1>
        <p className="text-sm text-slate-500 mt-1">Use this during an active job. Location and job details stay private to you and FixBuddy support.</p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{msg}</p>}

      <Card padding="md" className="bg-red-50 border-red-200 space-y-3">
        <Button variant="danger" fullWidth loading={busy === "emergency"} onClick={() => void run("emergency")}>
          <ShieldAlert className="w-5 h-5" /> SAFETY — record incident
        </Button>
        <Textarea label="What happened? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </Card>

      <div className="space-y-2">
        {ACTIONS.map((a) => (
          <button
            key={a.type}
            type="button"
            disabled={!!busy}
            onClick={() => void run(a.type)}
            className="w-full min-h-14 rounded-2xl border border-slate-200 bg-white px-4 flex items-center gap-3 text-left hover:bg-slate-50"
          >
            <a.icon className="w-5 h-5 text-brand" />
            <span className="font-semibold text-slate-800">{a.label}</span>
          </button>
        ))}
      </div>

      <Button variant="outline" fullWidth onClick={() => navigate("work-requests")}>
        Back to active job
      </Button>
    </div>
  );
}
