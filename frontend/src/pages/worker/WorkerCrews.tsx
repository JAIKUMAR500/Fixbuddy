import React, { useEffect, useState } from "react";
import { Users, Star } from "lucide-react";
import { View } from "../../types";
import { Button, Card, EmptyState, Input, Textarea } from "../../components/ui";
import { CrewAPI, RequestAPI, type WorkerCrew } from "../../api/client";
import { useApp } from "../../api/AppContext";

export default function WorkerCrews({ navigate }: { navigate: (v: View) => void }) {
  const { user, setActiveRequestId } = useApp();
  const [crews, setCrews] = useState<WorkerCrew[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [serviceArea, setServiceArea] = useState(user?.city || "");
  const [maxMembers, setMaxMembers] = useState("4");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; userCode: string; category: string; ratingAvg: number }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const r = await CrewAPI.mine();
      setCrews(r.crews);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load teams");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      await CrewAPI.create({
        name,
        description,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        serviceArea,
        maxMembers: Number(maxMembers || 4),
      });
      setCreating(false);
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create team");
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    if (query.trim().length < 2) return;
    const r = await CrewAPI.searchWorkers(query.trim());
    setFound(r.workers);
  };

  const mine = crews.find((c) => c.members.some((m) => m.userId === user?.id && m.status === "active"));
  const pending = crews.filter((c) => c.members.some((m) => m.userId === user?.id && m.status === "pending"));
  const leader = mine && mine.leaderId === user?.id;

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Worker power</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">My team</h1>
        <p className="text-sm text-slate-500 mt-1">Create a crew, invite workers, and take larger jobs together.</p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

      {pending.map((c) => {
        const inv = c.members.find((m) => m.userId === user?.id);
        return (
          <Card key={c.id} padding="md" className="border-amber-200 bg-amber-50 space-y-3">
            <p className="font-semibold text-slate-900">{c.name} invited you</p>
            <p className="text-xs text-slate-600">{c.description || c.skills.join(" · ")}</p>
            <div className="flex gap-2">
              <Button
                onClick={() => void CrewAPI.acceptInvite(c.id, inv?.id || "").then(load)}
              >
                Accept
              </Button>
              <Button variant="outline" onClick={() => void CrewAPI.rejectInvite(c.id, inv?.id || "").then(load)}>
                Decline
              </Button>
            </div>
          </Card>
        );
      })}

      {mine ? (
        <Card padding="md" className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl font-bold text-slate-900">{mine.name}</p>
              <p className="text-sm text-slate-500">{mine.description}</p>
            </div>
            <span className="text-xs font-semibold bg-sky-50 text-sky-700 px-2 py-1 rounded-lg">{leader ? "Leader" : "Member"}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {mine.activeCount}/{mine.maxMembers}
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-500" /> {mine.ratingAvg || "—"}
            </span>
            <span>{mine.completedJobs} jobs</span>
          </div>
          <p className="text-xs text-slate-500">Skills: {mine.skills.join(", ") || "—"} · {mine.serviceArea || "Any area"}</p>
          <p className="text-xs text-slate-500">Split: {mine.splitMode}</p>
          <div className="space-y-2">
            {mine.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {m.role} · {m.status} · {m.category || "Worker"}
                    {m.verified ? " · Verified" : ""}
                  </p>
                </div>
                {leader && m.role !== "leader" && (
                  <button
                    type="button"
                    className="text-xs text-red-500 font-semibold"
                    onClick={() => void CrewAPI.removeMember(mine.id, m.id).then(load)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {leader && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-sm font-semibold">Invite a worker</p>
              <div className="flex gap-2">
                <Input label="Name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Button className="self-end" onClick={() => void search()}>
                  Search
                </Button>
              </div>
              {found.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="w-full text-left rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  onClick={() => void CrewAPI.invite(mine.id, w.id).then(() => { setFound([]); void load(); })}
                >
                  <p className="text-sm font-semibold">{w.name}</p>
                  <p className="text-[11px] text-slate-500">{w.userCode} · {w.category} · {w.ratingAvg}★</p>
                </button>
              ))}
              <LeaderJobs crewId={mine.id} memberIds={mine.members.filter((m) => m.status === "active").map((m) => m.userId)} onOpen={(id) => { setActiveRequestId(id); navigate("work-requests"); }} />
            </div>
          )}
        </Card>
      ) : (
        <>
          {!creating ? (
            <EmptyState icon="👥" title="No team yet" description="Create a crew to take house-shifting and other multi-worker jobs." actionLabel="Create team" onAction={() => setCreating(true)} />
          ) : (
            <Card padding="md" className="space-y-3">
              <Input label="Team name" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input label="Skills (comma separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
              <Input label="Service area" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} />
              <Input label="Maximum members" type="number" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
              <Button fullWidth loading={busy} onClick={() => void create()}>
                Create team
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function LeaderJobs({ crewId, memberIds, onOpen }: { crewId: string; memberIds: string[]; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<{ id: string; category: string; status: string; estimatedAmount: number }[]>([]);
  useEffect(() => {
    void RequestAPI.list("?inbox=true")
      .then((d) => setRows(d.requests.filter((r) => r.crewId === crewId && ["matching", "open", "requested"].includes(r.status))))
      .catch(() => setRows([]));
  }, [crewId]);
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Team job requests</p>
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="text-sm font-semibold">{r.category} · ₹{r.estimatedAmount}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void CrewAPI.acceptJob(crewId, r.id, memberIds).then(() => onOpen(r.id))}>
              Accept & assign
            </Button>
            <Button size="sm" variant="outline" onClick={() => void CrewAPI.acceptJob(crewId, r.id, [], true).then(() => setRows((x) => x.filter((i) => i.id !== r.id)))}>
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
