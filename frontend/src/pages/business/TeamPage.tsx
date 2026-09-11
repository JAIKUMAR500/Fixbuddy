import React, { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input } from "../../components/ui";
import { TeamAPI, type TeamPayload } from "../../api/client";
import { useLang } from "../../i18n/LangContext";
import { useApp } from "../../api/AppContext";

const empty: TeamPayload = { groups: [], members: [] };

export default function TeamPage() {
  const { t } = useLang();
  const [team, setTeam] = useState<TeamPayload>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [member, setMember] = useState({ name: "", email: "", phone: "", role: "staff", groupId: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState("");

  const load = () => {
    TeamAPI.get()
      .then((d) => setTeam(d.team))
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
      setError(e instanceof Error ? e.message : "Could not update team");
    } finally {
      setBusy("");
    }
  };

  const groupLabel = (id: string) => team.groups.find((g) => g.id === id)?.name || "Ungrouped";

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold font-display">{t("team.title")}</h1>
        <p className="text-sm text-slate-500">Create groups and add staff. Invite by email — if they already have a worker login, they join as active.</p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      {loading && <Card className="text-sm text-slate-500">Loading team...</Card>}

      <Card className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-brand" /> {t("team.groups")}</h2>
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!groupName.trim()) return;
            void run("group", () => TeamAPI.addGroup(groupName.trim())).then(() => setGroupName(""));
          }}
        >
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t("team.newGroup")} />
          <Button type="submit" className="shrink-0" loading={busy === "group"}><Plus className="w-4 h-4" /> {t("common.add")}</Button>
        </form>
        <div className="grid sm:grid-cols-2 gap-3">
          {team.groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 px-3 py-3">
              {editingId === g.id ? (
                <input className="flex-1 rounded-lg border border-sky-200 px-2 py-1 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
              ) : (
                <p className="font-medium text-sm">{g.name}</p>
              )}
              <div className="flex gap-1">
                {editingId === g.id ? (
                  <Button size="sm" onClick={() => void run("g-" + g.id, () => TeamAPI.patchGroup(g.id, { name: editName })).then(() => setEditingId(null))}>{t("common.save")}</Button>
                ) : (
                  <button type="button" className="p-2 rounded-lg hover:bg-slate-100" onClick={() => { setEditingId(g.id); setEditName(g.name); }}><Pencil className="w-4 h-4" /></button>
                )}
                <button type="button" className="p-2 rounded-lg hover:bg-red-50 text-red-500" onClick={() => void run("gd-" + g.id, () => TeamAPI.removeGroup(g.id))}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!team.groups.length && <p className="text-sm text-slate-500">No groups yet. Try “AC crew” or “Office staff”.</p>}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">{t("team.members")}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Name" value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} />
          <Input label="Email" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} />
          <Input label="Phone" value={member.phone} onChange={(e) => setMember({ ...member, phone: e.target.value })} />
          <div>
            <label className="text-sm font-medium text-slate-700">Group</label>
            <select className="mt-1.5 w-full px-4 py-3 rounded-xl border border-slate-200 text-sm" value={member.groupId} onChange={(e) => setMember({ ...member, groupId: e.target.value })}>
              <option value="">Ungrouped</option>
              {team.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={member.role === "staff" ? "primary" : "secondary"} onClick={() => setMember({ ...member, role: "staff" })}>Staff</Button>
          <Button variant={member.role === "lead" ? "primary" : "secondary"} onClick={() => setMember({ ...member, role: "lead" })}>Lead</Button>
          <Button
            className="ml-auto"
            loading={busy === "member"}
            onClick={() => {
              if (!member.name.trim()) { setError("Member name is required"); return; }
              void run("member", () => TeamAPI.addMember(member)).then(() => setMember({ name: "", email: "", phone: "", role: "staff", groupId: "" }));
            }}
          >
            {t("team.invite")}
          </Button>
        </div>
      </Card>

      {!team.members.length && !loading && (
        <EmptyState icon="👥" title="No team members yet" description="Add staff and put them in groups so jobs can be shared." />
      )}

      <div className="space-y-3">
        {team.members.map((m) => (
          <Card key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{m.name}</p>
              <p className="text-xs text-slate-500 truncate">{m.email || m.phone || "No contact"} · {groupLabel(m.groupId)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={m.status === "active" ? "success" : "warning"}>{m.status}</Badge>
              <Badge variant="info">{m.role}</Badge>
              <select
                className="rounded-lg border border-slate-200 text-xs px-2 py-2"
                value={m.groupId}
                onChange={(e) => void run("mg-" + m.id, () => TeamAPI.patchMember(m.id, { groupId: e.target.value }))}
              >
                <option value="">Ungrouped</option>
                {team.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Button size="sm" variant="ghost" onClick={() => void run("md-" + m.id, () => TeamAPI.removeMember(m.id))}>{t("common.delete")}</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
