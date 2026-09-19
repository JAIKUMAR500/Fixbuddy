import React, { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { View } from "../../types";
import { Button, Card } from "../../components/ui";
import { PublicAPI, mediaUrl, type WorkerPassport } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { passportCodeFromPath } from "../../api/routes";

export default function PublicPassport({ navigate }: { navigate: (v: View) => void }) {
  const { user } = useApp();
  const code =
    passportCodeFromPath(window.location.pathname) ||
    new URLSearchParams(window.location.search).get("pro") ||
    user?.userCode ||
    "";
  const [p, setP] = useState<WorkerPassport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) {
      setError("No professional profile specified.");
      return;
    }
    void PublicAPI.pro(code)
      .then((d) => setP(d.profile))
      .catch(() => setError("This professional profile is not available."));
  }, [code]);

  if (error || !p) {
    return (
      <div className="min-h-screen bg-canvas p-6 flex items-center justify-center">
        <Card padding="lg" className="max-w-md text-center space-y-3">
          <p className="font-display text-xl font-bold">{error || "Loading…"}</p>
          <Button onClick={() => navigate(user ? (user.role === "worker" ? "worker-passport" : "customer-home") : "landing")}>Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="bg-navy text-white px-5 pt-10 pb-16">
        <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200">FixBuddy Professional</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/10">
            {p.avatar ? <img src={mediaUrl(p.avatar)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{p.name.slice(0, 1)}</div>}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{p.name}</h1>
            <p className="text-sky-200">{p.category || "Skilled worker"}</p>
            {p.verified && (
              <p className="text-xs text-emerald-300 mt-1 flex items-center gap-1">
                <BadgeCheck className="w-4 h-4" /> Verified
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 -mt-8 space-y-4 pb-16 max-w-xl mx-auto">
        <Card padding="md" className="grid grid-cols-2 gap-3">
          <Mini label="Jobs completed" value={String(p.completedJobs)} />
          <Mini label="Rating" value={`${p.ratingAvg} ★`} />
          <Mini label="On-time" value={`${p.onTimePct}%`} />
          <Mini label="Cancellation" value={`${p.cancelPct}%`} />
        </Card>
        <Card padding="md">
          <p className="font-semibold mb-2">Skills</p>
          <div className="flex flex-wrap gap-2">
            {(p.skills || []).map((s) => (
              <span key={s.name} className="px-3 py-1 rounded-full bg-sky-50 text-sky-800 text-xs font-semibold">
                {s.verified ? "✓ " : ""}
                {s.name}
              </span>
            ))}
          </div>
        </Card>
        <Card padding="md">
          <p className="font-semibold mb-1">Experience</p>
          <p className="text-sm text-slate-600">{p.experience || "—"}</p>
          {p.bio && <p className="text-sm text-slate-600 mt-2">{p.bio}</p>}
          <p className="text-xs text-slate-400 mt-3">{p.area || p.city} · {(p.languages || []).join(", ")}</p>
        </Card>
        <Card padding="md">
          <p className="font-semibold mb-2">Badges</p>
          <div className="flex flex-wrap gap-2">
            {(p.badges || []).map((b) => (
              <span key={b.id} className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </Card>
        <p className="text-[11px] text-center text-slate-400">Private phone, ID and bank details are never shown here.</p>
        {user?.role === "customer" && (
          <Button fullWidth onClick={() => navigate("create-request")}>
            Book this professional
          </Button>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="font-bold text-slate-900">{value}</p>
    </div>
  );
}
