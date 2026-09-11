import React, { useEffect, useMemo, useState } from "react";
import { BadgeCheck, QrCode } from "lucide-react";
import { View } from "../../types";
import { Button, Card, Input, Textarea } from "../../components/ui";
import { WorkerAPI, mediaUrl, type WorkerPassport } from "../../api/client";
import { useApp } from "../../api/AppContext";

export default function WorkerPassport({ navigate }: { navigate: (v: View) => void }) {
  const { user } = useApp();
  const [p, setP] = useState<WorkerPassport | null>(null);
  const [skill, setSkill] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [languages, setLanguages] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const r = await WorkerAPI.passport();
      setP(r.passport);
      setBio(r.passport.bio || "");
      setExperience(r.passport.experience || "");
      setLanguages((r.passport.languages || []).join(", "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load passport");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const code = p?.userCode || user?.userCode || "";
  const publicUrl = useMemo(() => `${window.location.origin}/?pro=${encodeURIComponent(code)}`, [code]);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}`;

  const save = async () => {
    setError("");
    try {
      const r = await WorkerAPI.updatePassport({
        bio,
        experience,
        languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setP(r.passport);
      setMsg("Passport updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const add = async () => {
    if (!skill.trim()) return;
    try {
      await WorkerAPI.addSkill(skill.trim());
      setSkill("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add skill");
    }
  };

  if (!p) {
    return <div className="p-6 text-sm text-slate-500">{error || "Loading passport…"}</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">FixBuddy professional</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">Skill passport</h1>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{msg}</p>}

      <Card padding="md" className="bg-navy text-white border-navy">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/10">
            {p.avatar ? <img src={mediaUrl(p.avatar)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{p.name.slice(0, 1)}</div>}
          </div>
          <div>
            <p className="font-display text-xl font-bold">{p.name}</p>
            <p className="text-sky-200 text-sm">{p.category || "Worker"}</p>
            {p.verified && (
              <p className="text-xs text-emerald-300 mt-1 flex items-center gap-1">
                <BadgeCheck className="w-4 h-4" /> Verified
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <Stat label="Jobs" value={String(p.completedJobs)} />
          <Stat label="Rating" value={`${p.ratingAvg || 0} ★`} />
          <Stat label="On-time" value={`${p.onTimePct}%`} />
          <Stat label="Cancellation" value={`${p.cancelPct}%`} />
        </div>
      </Card>

      <Card padding="md">
        <p className="font-semibold mb-2">Badges</p>
        <div className="flex flex-wrap gap-2">
          {(p.badges || []).map((b) => (
            <span key={b.id} className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">
              {b.icon} {b.label}
            </span>
          ))}
          {!p.badges?.length && <p className="text-sm text-slate-500">Complete paid jobs to earn badges. Stats cannot be edited.</p>}
        </div>
      </Card>

      <Card padding="md" className="space-y-3">
        <p className="font-semibold">Skills</p>
        {(p.skills || []).map((s) => (
          <div key={s.id || s.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-medium">{s.name}</p>
            {s.verified ? (
              <span className="text-xs text-emerald-700 font-semibold">✓ Verified</span>
            ) : s.pending ? (
              <span className="text-xs text-amber-700">⏳ Pending</span>
            ) : (
              <button
                type="button"
                className="text-xs font-semibold text-brand"
                onClick={() => void WorkerAPI.requestVerify(s.id || s.name).then(load)}
              >
                Request verification
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <Input label="Add skill" value={skill} onChange={(e) => setSkill(e.target.value)} />
          <Button className="self-end" onClick={() => void add()}>
            Add
          </Button>
        </div>
      </Card>

      <Card padding="md" className="space-y-3">
        <Textarea label="Professional bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        <Input label="Experience" value={experience} onChange={(e) => setExperience(e.target.value)} />
        <Input label="Languages" value={languages} onChange={(e) => setLanguages(e.target.value)} />
        <Button onClick={() => void save()}>Save passport</Button>
      </Card>

      <Card padding="md" className="text-center space-y-3">
        <p className="font-semibold flex items-center justify-center gap-2">
          <QrCode className="w-4 h-4" /> Public QR
        </p>
        <img src={qr} alt="Professional QR" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" />
        <p className="text-xs text-slate-500 break-all">{publicUrl}</p>
        <Button variant="outline" onClick={() => navigate("public-passport")}>
          Preview public profile
        </Button>
      </Card>
      {(p.proof || []).length > 0 && (
        <Card padding="md">
          <p className="font-semibold mb-2">Recent work proof</p>
          <div className="grid grid-cols-2 gap-2">
            {p.proof!.map((item, i) => (
              <div key={`${item.category}-${i}`} className="rounded-xl overflow-hidden border border-slate-100">
                {item.after || item.before ? (
                  <img src={mediaUrl(item.after || item.before)} alt="" className="w-full h-24 object-cover" />
                ) : null}
                <p className="text-xs text-slate-500 px-2 py-1">{item.category}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[11px] text-sky-200">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
