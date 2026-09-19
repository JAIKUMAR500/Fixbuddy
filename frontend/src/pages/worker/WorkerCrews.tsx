import React, { useEffect, useState } from "react";
import { Users, Star } from "lucide-react";
import { View } from "../../types";
import { Button, Card, EmptyState, Input, Textarea } from "../../components/ui";
import { CrewAPI, RequestAPI, TeamAPI, type TeamPayload, type WorkerCrew } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { isWorkerBusyConflict, jobError } from "../../api/jobLock";

export default function WorkerCrews({ navigate }: { navigate: (v: View) => void }) {
  const { user, setActiveRequestId } = useApp();
  const [crews, setCrews] = useState<WorkerCrew[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [serviceArea, setServiceArea] = useState(user?.city || "");
  const [maxMembers, setMaxMembers] = useState("4");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; userCode: string; category: string; ratingAvg: number; verified?: boolean }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const [bizInvites, setBizInvites] = useState<{ teamId: string; memberId: string; businessName: string }[]>([]);
  const [bizActive, setBizActive] = useState<{ teamId: string; memberId: string; businessName: string; role: string }[]>([]);

  const load = async () => {
    try {
      const [r, team] = await Promise.all([
        CrewAPI.mine(),
        TeamAPI.get().catch(() => ({
          team: null as TeamPayload | null,
          memberships: [] as {
            teamId: string;
            businessName?: string;
            member: { id: string; status: string; name: string; role?: string } | null;
          }[],
        })),
      ]);
      setCrews(r.crews);
      if (!selectedId && r.crews.length) {
        const lead = r.crews.find((c) => c.leaderId === user?.id);
        setSelectedId(lead?.id || r.crews[0].id);
      }
      const memberships = team.memberships || [];
      setBizInvites(
        memberships
          .filter((m) => m.member?.status === "pending")
          .map((m) => ({
            teamId: m.teamId,
            memberId: m.member!.id,
            businessName: m.businessName || "A business",
          }))
      );
      setBizActive(
        memberships
          .filter((m) => m.member?.status === "active")
          .map((m) => ({
            teamId: m.teamId,
            memberId: m.member!.id,
            businessName: m.businessName || "Business",
            role: m.member?.role || "worker",
          }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load crews");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await CrewAPI.create({
        name,
        description,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        serviceArea,
        maxMembers: Number(maxMembers || 4),
      });
      setCreating(false);
      setName("");
      setSelectedId(r.crew.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create crew");
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    if (query.trim().length < 2) return;
    const r = await CrewAPI.searchWorkers(query.trim());
    setFound(r.workers);
  };

  const pending = crews.filter((c) => c.members.some((m) => m.userId === user?.id && m.status === "pending"));
  const activeCrews = crews.filter((c) => c.members.some((m) => m.userId === user?.id && m.status === "active"));
  const mine = activeCrews.find((c) => c.id === selectedId) || activeCrews[0] || null;
  const leader = mine && mine.leaderId === user?.id;

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 max-w-xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Worker power</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">My Crews</h1>
        <p className="text-sm text-slate-500 mt-1">Independent workers collaborating on jobs. This is not a Business Team.</p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

      {bizInvites.map((inv) => (
        <Card key={inv.memberId} padding="md" className="border-indigo-200 bg-indigo-50 space-y-3">
          <p className="font-semibold text-slate-900">Business Team invite</p>
          <p className="text-sm text-slate-600">{inv.businessName} invited you to join their Business Team.</p>
          <div className="flex gap-2">
            <Button onClick={() => void TeamAPI.acceptInvite(inv.memberId).then(load)}>Accept</Button>
            <Button variant="outline" onClick={() => void TeamAPI.rejectInvite(inv.memberId).then(load)}>
              Decline
            </Button>
          </div>
        </Card>
      ))}

      {bizActive.map((m) => (
        <Card key={m.memberId} padding="md" className="space-y-2 border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Business Team</p>
          <p className="font-semibold text-slate-900">{m.businessName}</p>
          <p className="text-xs text-slate-500 capitalize">Your role: {m.role}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!window.confirm(`Leave ${m.businessName}? Your worker account stays intact.`)) return;
              void TeamAPI.leave(m.teamId).then(load).catch((e) => setError(jobError(e)));
            }}
          >
            Leave Business Team
          </Button>
        </Card>
      ))}

      {pending.map((c) => {
        const inv = c.members.find((m) => m.userId === user?.id);
        return (
          <Card key={c.id} padding="md" className="border-amber-200 bg-amber-50 space-y-3">
            <p className="font-semibold text-slate-900">{c.leader?.name || "A worker"} invited you to {c.name}</p>
            <p className="text-xs text-slate-600">{c.description || c.skills.join(" · ")}</p>
            <div className="flex gap-2">
              <Button onClick={() => void CrewAPI.acceptInvite(c.id, inv?.id || "").then(load)}>Accept</Button>
              <Button variant="outline" onClick={() => void CrewAPI.rejectInvite(c.id, inv?.id || "").then(load)}>
                Decline
              </Button>
            </div>
          </Card>
        );
      })}

      {activeCrews.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {activeCrews.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border ${mine?.id === c.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {mine ? (
        <Card padding="md" className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl font-bold text-slate-900">{mine.name}</p>
              <p className="text-sm text-slate-500">{mine.description}</p>
            </div>
            <div className="text-right space-y-1">
              <span className="text-xs font-semibold bg-sky-50 text-sky-700 px-2 py-1 rounded-lg">{leader ? "Crew Lead" : "Member"}</span>
              {mine.verified ? <p className="text-[11px] font-semibold text-emerald-700">Verified Crew ✓</p> : null}
            </div>
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
          <div className="space-y-2">
            {mine.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {m.role === "leader" ? "Lead" : "Member"} · {m.status} · {m.category || "Worker"}
                    {m.verified ? " · Verified Worker ✓" : ""}
                  </p>
                </div>
                {leader && m.role !== "leader" && m.status === "active" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-sky-700 font-semibold"
                      onClick={() => {
                        if (!window.confirm(`Make ${m.name} the crew lead?`)) return;
                        void CrewAPI.transferLead(mine.id, m.userId)
                          .then(load)
                          .catch((e) => setError(jobError(e)));
                      }}
                    >
                      Make lead
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-500 font-semibold"
                      onClick={() => void CrewAPI.removeMember(mine.id, m.id).then(load).catch((e) => setError(jobError(e)))}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!leader && (
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                if (!window.confirm(`Leave ${mine.name}? Your worker account stays intact.`)) return;
                void CrewAPI.leave(mine.id)
                  .then(() => {
                    setSelectedId("");
                    return load();
                  })
                  .catch((e) => setError(jobError(e)));
              }}
            >
              Leave crew
            </Button>
          )}
          {leader && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                fullWidth
                className="text-red-600 border-red-200"
                onClick={() => {
                  if (!window.confirm(`Dissolve ${mine.name}? Members keep their worker accounts.`)) return;
                  void CrewAPI.dissolve(mine.id)
                    .then(() => {
                      setSelectedId("");
                      return load();
                    })
                    .catch((e) => setError(jobError(e)));
                }}
              >
                Dissolve crew
              </Button>
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
                  onClick={() =>
                    void CrewAPI.invite(mine.id, w.id)
                      .then(() => {
                        setFound([]);
                        void load();
                      })
                      .catch((e) => setError(jobError(e)))
                  }
                >
                  <p className="text-sm font-semibold">{w.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {w.userCode} · {w.category} · {w.ratingAvg}★{w.verified ? " · Verified Worker ✓" : ""}
                  </p>
                </button>
              ))}
              <LeaderJobs
                crewId={mine.id}
                memberIds={mine.members.filter((m) => m.status === "active").map((m) => m.userId)}
                onOpen={(id) => {
                  setActiveRequestId(id);
                  navigate("active-job");
                }}
                onBusy={() => navigate("active-job")}
              />
            </div>
          )}
        </Card>
      ) : (
        <>
          {!creating ? (
            <EmptyState
              icon="👥"
              title="No crew yet"
              description="Create a crew of independent workers for multi-person jobs."
              actionLabel="Create crew"
              onAction={() => setCreating(true)}
            />
          ) : (
            <Card padding="md" className="space-y-3">
              <Input label="Crew name" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input label="Skills (comma separated)" value={skills} onChange={(e) => setSkills(e.target.value)} />
              <Input label="Service area" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} />
              <Input label="Maximum members" type="number" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
              <Button fullWidth loading={busy} onClick={() => void create()}>
                Create crew
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function LeaderJobs({
  crewId,
  memberIds,
  onOpen,
  onBusy,
}: {
  crewId: string;
  memberIds: string[];
  onOpen: (id: string) => void;
  onBusy: () => void;
}) {
  const { refreshCurrentJob } = useApp();
  const [rows, setRows] = useState<{ id: string; category: string; status: string; estimatedAmount: number; crewId?: string | null }[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void RequestAPI.list("?inbox=true")
      .then((d) =>
        setRows(
          d.requests.filter(
            (r) =>
              ["matching", "open", "requested"].includes(r.status) &&
              (!r.crewId || r.crewId === crewId)
          )
        )
      )
      .catch(() => setRows([]));
  }, [crewId]);

  const accept = async (id: string) => {
    setMsg("");
    try {
      await CrewAPI.acceptJob(crewId, id, memberIds);
      await refreshCurrentJob();
      onOpen(id);
    } catch (e) {
      setMsg(jobError(e));
      if (isWorkerBusyConflict(e)) {
        await refreshCurrentJob();
        onBusy();
      } else {
        setRows((x) => x.filter((i) => i.id !== id));
      }
    }
  };

  if (!rows.length && !msg) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Crew job requests</p>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="text-sm font-semibold">
            {r.category} · ₹{r.estimatedAmount}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void accept(r.id)}>
              Accept & assign
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void CrewAPI.acceptJob(crewId, r.id, [], true).then(() => setRows((x) => x.filter((i) => i.id !== r.id)))}
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
