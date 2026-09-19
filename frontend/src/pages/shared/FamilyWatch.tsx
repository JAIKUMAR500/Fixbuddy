import React, { useEffect, useState } from "react";
import { View } from "../../types";
import { Button, Card } from "../../components/ui";
import TrackMap from "../../components/TrackMap";
import { PublicAPI, mediaUrl } from "../../api/client";
import { statusLabel } from "../../api/jobLock";
import { watchTokenFromPath } from "../../api/routes";

export default function FamilyWatch({ navigate }: { navigate: (v: View) => void }) {
  const token =
    watchTokenFromPath(window.location.pathname) ||
    new URLSearchParams(window.location.search).get("watch") ||
    "";
  const [data, setData] = useState<Awaited<ReturnType<typeof PublicAPI.watch>>["watch"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This watch link is missing.");
      return;
    }
    const load = () =>
      PublicAPI.watch(token)
        .then((d) => {
          setData(d.watch);
          setError("");
        })
        .catch(() => setError("This watch link has expired or was revoked."));
    void load();
    const t = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(t);
  }, [token]);

  if (error || !data) {
    return (
      <div className="min-h-screen bg-canvas p-6 flex items-center justify-center">
        <Card padding="lg" className="max-w-md text-center space-y-3">
          <p className="font-display text-xl font-bold">{error || "Loading…"}</p>
          <Button onClick={() => navigate("landing")}>Back to FixBuddy</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="bg-navy text-white px-5 pt-10 pb-12">
        <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200">FixBuddy Family Watch</p>
        <h1 className="font-display text-2xl font-bold mt-2">{data.category}</h1>
        <p className="text-sky-100 text-sm mt-1">{statusLabel(data.status)}</p>
      </div>
      <div className="px-4 -mt-6 space-y-4 pb-16 max-w-lg mx-auto">
        <Card padding="md" className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100">
            {data.worker?.avatar ? (
              <img src={mediaUrl(data.worker.avatar)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold">{(data.worker?.firstName || "W").slice(0, 1)}</div>
            )}
          </div>
          <div>
            <p className="font-semibold">{data.worker?.firstName || "Worker"}</p>
            <p className="text-xs text-slate-500">
              {data.worker?.verified ? "Verified · " : ""}⭐ {data.worker?.rating || 0}
            </p>
            <p className="text-xs text-slate-500">{data.area || data.city}</p>
          </div>
        </Card>
        {data.delayText && (
          <Card padding="md" className="bg-sky-50 border-sky-200 text-sm text-sky-900">
            {data.delayText}
          </Card>
        )}
        <TrackMap
          customer={undefined}
          worker={data.workerApprox}
          tapHint="Open worker location in Google Maps"
        />
        {data.etaMinutes ? <p className="text-sm text-slate-600">ETA about {data.etaMinutes} minutes</p> : null}
        <Card padding="md">
          <p className="text-xs font-semibold text-slate-500 mb-2">Progress</p>
          <ol className="space-y-1">
            {(data.timeline || []).slice(-8).map((row, i) => (
              <li key={`${row.status}-${i}`} className="text-sm text-slate-700">
                ✓ {row.note || statusLabel(row.status)}
              </li>
            ))}
          </ol>
        </Card>
        <p className="text-xs text-slate-400">Read-only live view. Private details and OTP are hidden.</p>
      </div>
    </div>
  );
}
