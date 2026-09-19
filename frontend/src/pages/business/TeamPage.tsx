import React, { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input } from "../../components/ui";
import { TeamAPI, type TeamPayload } from "../../api/client";
import { useLang } from "../../i18n/LangContext";
import { jobError } from "../../api/jobLock";

const empty: TeamPayload = { groups: [], members: [] };

export default function TeamPage() {
  const { t } = useLang();
  const [team, setTeam] = useState<TeamPayload>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; userCode: string; category: string; verified: boolean; ratingAvg: number }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState("");

  const load = () => {
    TeamAPI.get()
      .then((d) => setTeam(d.team || empty))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (key: string, fn: () => Promise<{ team: TeamPayload }>) => {
    setBusy(key);
    setError("");
    try {
      const d = await fn();
      setTeam(d.team);
    } catch (e) {
      setError(jobError(e));
    } finally {
      setBusy("");
    }
  };

  const search = async () => {
    if (query.trim().length < 2) return;
    setBusy("search");
    try {
      const r = await TeamAPI.searchWorkers(query.trim());
      setFound(r.workers);
    } catch (e) {
      setError(jobError(e));
    } finally {
      setBusy("");
    }
  };

  const groupLabel = (id: string) => team.groups.find((g) => g.id === id)?.name || "Ungrouped";

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">{t("team.title") || "Business Team"}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage workers linked to your business account. This is not a Crew — workers keep their own FixBuddy accounts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Invite existing worker
          </p>
          {team.myRole && (
            <Badge variant="info">You: {team.myRole === "owner" ? "Owner" : team.myRole}</Badge>
          )}
        </div>
        {!team.canManage && team.myRole === "worker" ? (
          <p className="text-sm text-slate-500">Business Workers can view the roster. Owner/Manager invites workers.</p>
        ) : (
          <>
        <div className="flex gap-2">
          <Input label="Search name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button className="self-end" loading={busy === "search"} onClick={() => void search()}>
            Search
          </Button>
        </div>
        {found.map((w) => (
          <button
            key={w.id}
            type="button"
            className="w-full text-left rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
            onClick={() =>
              void run("invite", () => TeamAPI.invite(w.id)).then(() => {
                setFound([]);
                setQuery("");
              })
            }
          >
            <p className="text-sm font-semibold">{w.name}</p>
            <p className="text-[11px] text-slate-500">
              {w.category || "Worker"} · {w.ratingAvg}★{w.verified ? " · Verified Worker ✓" : ""} · {w.userCode}
            </p>
          </button>
        ))}
          </>
        )}
      </Card>

      {(team.canManage !== false) && (
      <Card padding="md" className="space-y-3">
        <p className="font-semibold">Groups</p>
        <div className="flex gap-2">
          <Input label="New group" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <Button
            className="self-end"
            loading={busy === "group"}
            onClick={() => {
              if (!groupName.trim()) return;
              void run("group", () => TeamAPI.addGroup(groupName.trim())).then(() => setGroupName(""));
            }}
          >
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {team.groups.map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
              {editingId === g.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Button
                    size="sm"
                    onClick={() => void run("g-" + g.id, () => TeamAPI.patchGroup(g.id, { name: editName })).then(() => setEditingId(null))}
                  >
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-semibold">{g.name}</p>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-slate-50"
                    onClick={() => {
                      setEditingId(g.id);
                      setEditName(g.name);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    onClick={() => void run("gd-" + g.id, () => TeamAPI.removeGroup(g.id))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
          {!team.groups.length && <p className="text-sm text-slate-500">No groups yet.</p>}
        </div>
      </Card>
      )}

      <Card padding="md" className="space-y-3">
        <p className="font-semibold">Team members</p>
        {team.members.length === 0 ? (
          <EmptyState icon="👷" title="No workers yet" description="Search and invite existing FixBuddy workers." />
        ) : (
          team.members.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-100 px-3 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-sm flex-1">{m.name}</p>
                <Badge variant={m.status === "active" ? "success" : "warning"}>{m.status}</Badge>
                <Badge>{m.role}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                {m.email || "No email"} · {groupLabel(m.groupId)}
                {m.userId ? " · Linked worker account" : " · Not linked to a worker login"}
              </p>
              {team.canManage !== false && (
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-slate-200 text-xs px-2 py-1"
                  value={m.groupId || ""}
                  onChange={(e) => void run("mg-" + m.id, () => TeamAPI.patchMember(m.id, { groupId: e.target.value }))}
                >
                  <option value="">Ungrouped</option>
                  {team.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-200 text-xs px-2 py-1"
                  value={m.role}
                  onChange={(e) => void run("mr-" + m.id, () => TeamAPI.patchMember(m.id, { role: e.target.value }))}
                >
                  <option value="manager">Manager</option>
                  <option value="worker">Worker</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => void run("md-" + m.id, () => TeamAPI.removeMember(m.id))}>
                  Remove
                </Button>
              </div>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
