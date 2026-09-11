import React from "react";
import { BadgeCheck, Plus, Save, UserRound } from "lucide-react";
import { Button, Card, Input } from "../../components/ui";
import { WorkerAPI, type WorkerPassport as PassportData } from "../../api/client";
import { useFetch } from "../../api/AppContext";

export default function WorkerPassportPage() {
  const { data, loading, error, reload } = useFetch<{ passport: PassportData }>("/worker/passport");
  const [bio, setBio] = React.useState("");
  const [experienceYears, setExperienceYears] = React.useState("0");
  const [skills, setSkills] = React.useState("");
  const [message, setMessage] = React.useState("");
  const passport = data?.passport;

  React.useEffect(() => {
    if (!passport) return;
    setBio(passport.passport.bio);
    setExperienceYears(String(passport.passport.experienceYears));
    setSkills(passport.passport.skills.map((skill) => skill.name).join(", "));
  }, [passport]);

  const save = async () => {
    try {
      await WorkerAPI.savePassport({ bio, experienceYears: Number(experienceYears), skills: skills.split(",").map((name) => ({ name: name.trim(), level: "experienced" })).filter((skill) => skill.name) });
      setMessage("Professional passport updated.");
      reload();
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Could not update passport");
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6 max-w-3xl space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-brand">Worker profile</p><h1 className="mt-1 text-2xl font-bold font-display text-slate-900">Professional Passport</h1><p className="mt-1 text-sm text-slate-500">Build a trusted professional identity from verified work history.</p></div>
      {loading && <Card>Loading passport...</Card>}
      {error && <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}
      {message && <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{message}</Card>}
      {passport && <>
        <Card padding="lg" className="bg-navy text-white"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-slate-300">FixBuddy Professional</p><h2 className="mt-2 text-2xl font-bold">{passport.worker.name}</h2><p className="mt-1 text-slate-300">{passport.passport.skills[0]?.name || "Service professional"}</p></div><UserRound className="w-10 h-10 text-sky-300" /></div><div className="grid grid-cols-3 gap-3 mt-6 text-center"><div><p className="text-2xl font-black">{passport.stats.totalJobs}</p><p className="text-xs text-slate-300">Completed</p></div><div><p className="text-2xl font-black">{passport.stats.rating.toFixed(1)}</p><p className="text-xs text-slate-300">Rating</p></div><div><p className="text-2xl font-black">{passport.stats.verified ? "Yes" : "Pending"}</p><p className="text-xs text-slate-300">Verified</p></div></div></Card>
        <Card padding="lg" className="space-y-4"><h2 className="font-semibold text-slate-900 flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-emerald-600" /> Skills and experience</h2><Input label="Experience (years)" type="number" min="0" max="80" value={experienceYears} onChange={(event) => setExperienceYears(event.target.value)} /><label className="block text-sm font-medium text-slate-700">Professional bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={800} rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="block text-sm font-medium text-slate-700">Skills separated by commas<input value={skills} onChange={(event) => setSkills(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Plumbing, Pipe repair, Bathroom fittings" /></label><Button onClick={() => void save()}><Save className="w-4 h-4" /> Save passport</Button></Card>
        <Card padding="md"><h2 className="font-semibold text-slate-900 mb-3">Verified skills</h2><div className="flex flex-wrap gap-2">{passport.passport.skills.map((skill) => <span key={skill.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800"><Plus className="w-3 h-3" />{skill.name}{skill.verified ? " · Verified" : " · Pending"}</span>)}</div><div className="mt-4 flex flex-wrap gap-2">{(passport.badges || []).map((badge) => <span key={badge} className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">{badge}</span>)}</div>{passport.publicProfileUrl && <img className="mt-4 h-28 w-28 rounded-xl border border-slate-200" alt="Public passport QR" src={`https://quickchart.io/qr?size=180&text=${encodeURIComponent(`${window.location.origin}${passport.publicProfileUrl}`)}`} />}</Card>
      </>}
    </div>
  );
}
