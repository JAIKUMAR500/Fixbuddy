import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  LogOut,
} from "lucide-react";
import { View } from "../../types";
import {
  AdminAPI,
  AppUser,
  CategoryAPI,
  JobRequest,
  type AdminAudit,
  type AdminComplaint,
  type AdminReview,
  type AdminSettings,
  type AdminTxn,
  type ServiceCategory,
  type UserLicense,
  uploadImage,
} from "../../api/client";
import { Badge, Button, Card, Input, Skeleton, StatusBadge } from "../../components/ui";
import { useApp } from "../../api/AppContext";
import { roleLabel } from "../../api/roles";
import AnalyticsDashboard from "../shared/AnalyticsDashboard";
import { ComboChart, dayLabel } from "../../components/Charts";
import CategoryIcon, { CATEGORY_ICONS } from "../../components/CategoryIcon";
import { SUPPORT_EMAIL } from "../../api/brand";

type Overview = {
  users: number;
  workers: number;
  businesses: number;
  customers: number;
  requests: number;
  reviews: number;
  pendingVerification: number;
  activeJobs: number;
  completedJobs: number;
  revenue: number;
  customerGrowth: number;
  byStatus: Record<string, number>;
  recentActivity: { id: string; text: string; at: string }[];
};

const TITLES: Partial<Record<View, string>> = {
  admin: "Dashboard",
  "admin-customers": "Customer Management",
  "admin-providers": "Providers",
  "admin-workers": "Workers",
  "admin-verification": "Verification Center",
  "admin-requests": "Service Requests",
  "admin-reviews": "Reviews & Ratings",
  "admin-settings": "Settings",
  "admin-categories": "Service Categories",
  "admin-services": "Services",
  "admin-jobs": "Jobs / Bookings",
  "admin-notifications": "Notifications",
  "admin-complaints": "Complaints / Reports",
  "admin-transactions": "Transactions",
  "admin-analytics": "Analytics",
  "admin-users": "Admin Users",
  "admin-audit": "Audit Logs",
  "admin-licenses": "Login Licenses",
};

function money(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function when(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminPortal({ view }: { view: View; embedded?: boolean }) {
  const { logout } = useApp();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [txns, setTxns] = useState<AdminTxn[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<AdminAudit[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [analytics, setAnalytics] = useState<{ byCategory: { _id: string; n: number }[]; byCity: { _id: string; n: number }[]; byDay: { _id: string; n: number; revenue: number; jobs?: number; users?: number }[]; licenses?: Record<string, number> } | null>(null);
  const [licenseRows, setLicenseRows] = useState<{ id: string; userCode: string; name: string; email: string; role: string; license: UserLicense }[]>([]);
  const [licDays, setLicDays] = useState("30");
  const [licPlan, setLicPlan] = useState("pro");
  const [notifs, setNotifs] = useState<{ _id: string; text: string; type: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [detail, setDetail] = useState<{ requests: JobRequest[] } | null>(null);
  const [broadcast, setBroadcast] = useState("");
  const [newCat, setNewCat] = useState({ name: "", icon: "wrench", description: "" });
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "", role: "admin" });
  const [adminMsg, setAdminMsg] = useState("");
  const [pendingMail, setPendingMail] = useState(0);
  const [mailMsg, setMailMsg] = useState("");
  const [skillRows, setSkillRows] = useState<{ id: string; workerId: string; worker: string; email: string; name: string; level: string }[]>([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const roleQuery =
        view === "admin-customers"
          ? "?role=customer"
          : view === "admin-providers"
            ? "?role=business"
            : view === "admin-workers"
              ? "?role=worker"
              : view === "admin-users"
                ? "?role=admin"
                : view === "admin-verification"
                  ? "?pending=true"
                  : "";
      const jobsQuery = view === "admin-jobs" ? "?jobs=true" : "";
      const [summary, userList, requestList] = await Promise.all([
        AdminAPI.overview(),
        AdminAPI.users(roleQuery),
        AdminAPI.requests(jobsQuery),
      ]);
      setOverview(summary as Overview);
      setUsers(userList.users || []);
      setRequests(requestList.requests || []);

      if (view === "admin-reviews") setReviews((await AdminAPI.reviews()).reviews);
      if (view === "admin-complaints") setComplaints((await AdminAPI.complaints()).complaints);
      if (view === "admin-transactions") {
        const t = await AdminAPI.transactions();
        setTxns(t.transactions);
        setTotals(t.totals || {});
      }
      if (view === "admin-audit") setLogs((await AdminAPI.audit()).logs);
      if (view === "admin-categories" || view === "admin-services") setCategories((await CategoryAPI.all()).categories);
      if (view === "admin-settings") {
        const pack = await AdminAPI.settings();
        setSettings(pack.settings);
        setPendingMail(pack.pendingMail || 0);
      }
      if (view === "admin" || view === "admin-analytics") setAnalytics(await AdminAPI.analytics());
      if (view === "admin-licenses") setLicenseRows((await AdminAPI.licenses()).licenses);
      if (view === "admin-notifications") setNotifs((await AdminAPI.notifications()).notifications);
      if (view === "admin-verification") setSkillRows((await AdminAPI.skillVerification()).skills);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelected(null);
    setDetail(null);
    void load();
  }, [view]);

  const patch = async (id: string, body: object) => {
    await AdminAPI.patchUser(id, body);
    await load();
  };

  const openUser = async (account: AppUser) => {
    setSelected(account);
    const payload = await AdminAPI.user(account.id);
    setDetail({ requests: payload.requests });
  };

  const filteredUsers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      [u.name, u.email, u.phone, u.city, u.area, u.provider?.businessName].join(" ").toLowerCase().includes(term)
    );
  }, [users, q]);

  const title = TITLES[view] || "Dashboard";

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">FixBuddy Admin</p>
          <h1 className="text-2xl font-bold font-display text-slate-900">{title}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>
      {error && <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}

      {view === "admin" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Total Customers" value={overview?.customers} hint={`+${overview?.customerGrowth || 0}% from last week`} icon={<Users className="w-5 h-5" />} loading={loading} />
            <Kpi label="Total Providers" value={overview?.businesses} hint="Business job creators" icon={<ShieldCheck className="w-5 h-5" />} loading={loading} />
            <Kpi label="Active Workers" value={overview?.workers} hint="Job seekers on the platform" icon={<CheckCircle2 className="w-5 h-5" />} loading={loading} />
            <Kpi label="Pending Verification" value={overview?.pendingVerification} hint="Needs admin review" tone="warn" icon={<AlertTriangle className="w-5 h-5" />} loading={loading} />
            <Kpi label="Total Requests" value={overview?.requests} loading={loading} />
            <Kpi label="Active Jobs" value={overview?.activeJobs} loading={loading} />
            <Kpi label="Completed Jobs" value={overview?.completedJobs} loading={loading} />
            <Kpi label="Platform Revenue" value={money(overview?.revenue || 0)} hint="Commissions + payments" loading={loading} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <h2 className="font-semibold mb-1">Jobs trend</h2>
              <p className="text-xs text-slate-400 mb-2">Last 14 days</p>
              <ComboChart
                bars={(analytics?.byDay || []).map((d) => ({ label: dayLabel(d._id), value: d.revenue || 0 }))}
                line={(analytics?.byDay || []).map((d) => ({ label: dayLabel(d._id), value: d.jobs ?? d.n }))}
                barLabel="Revenue"
                lineLabel="Jobs"
              />
            </Card>
            <Card>
              <h2 className="font-semibold mb-3">Recent activity</h2>
              <div className="space-y-3">
                {(overview?.recentActivity || []).map((a) => (
                  <div key={a.id} className="text-sm">
                    <p className="text-slate-800">{a.text}</p>
                    <p className="text-xs text-slate-400">{when(a.at)}</p>
                  </div>
                ))}
                {!overview?.recentActivity?.length && <p className="text-sm text-slate-500">No activity yet.</p>}
              </div>
            </Card>
          </div>
          <Card padding="none">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-semibold">Recent users</h2></div>
            <UserTable users={users.slice(0, 8)} loading={loading} onPatch={patch} onOpen={openUser} />
          </Card>
        </>
      )}

      {(view === "admin-customers" || view === "admin-providers" || view === "admin-workers" || view === "admin-verification") && (
        selected ? (
          <UserDetail
            user={selected}
            requests={detail?.requests || []}
            onBack={() => { setSelected(null); setDetail(null); }}
            onPatch={patch}
            onReload={async () => {
              await load();
              if (selected) {
                const payload = await AdminAPI.user(selected.id);
                setSelected(payload.user);
                setDetail({ requests: payload.requests });
              }
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-9" />
                <Input className="pl-9" label="Search" placeholder="Name, email, city..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {view === "admin-verification" && (
                <p className="text-xs text-slate-500 pb-2">Workers and businesses waiting for verification.</p>
              )}
            </div>
            <Card padding="none">
              <UserTable
                users={filteredUsers}
                loading={loading}
                onPatch={patch}
                onOpen={openUser}
                showVerify={view !== "admin-customers"}
              />
            </Card>
            {view === "admin-verification" && <Card padding="md" className="mt-5"><h2 className="font-semibold text-slate-900 mb-3">Pending skill verification</h2>{skillRows.length === 0 ? <p className="text-sm text-slate-500">No skill requests waiting.</p> : <div className="space-y-2">{skillRows.map((skill) => <div key={skill.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-3"><div className="flex-1 min-w-[180px]"><p className="font-semibold text-sm text-slate-900">{skill.name} · {skill.level}</p><p className="text-xs text-slate-500">{skill.worker} · {skill.email}</p></div><Button size="sm" onClick={() => void AdminAPI.reviewSkill(skill.workerId, skill.id, { status: "verified" }).then(() => load())}>Approve</Button><Button size="sm" variant="outline" onClick={() => void AdminAPI.reviewSkill(skill.workerId, skill.id, { status: "rejected" }).then(() => load())}>Reject</Button></div>)}</div>}</Card>}
          </>
        )
      )}

      {view === "admin-users" && (
        selected ? (
          <UserDetail
            user={selected}
            requests={detail?.requests || []}
            onBack={() => { setSelected(null); setDetail(null); }}
            onPatch={patch}
            onReload={async () => {
              await load();
              if (selected) {
                const payload = await AdminAPI.user(selected.id);
                setSelected(payload.user);
                setDetail({ requests: payload.requests });
              }
            }}
          />
        ) : (
          <div className="space-y-5">
            <Card className="space-y-4">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">Add an admin</h2>
                <p className="text-sm text-slate-500">Create a Super Admin login. Password is set here — not a demo password.</p>
              </div>
              <form
                className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdminMsg("");
                  setError("");
                  void AdminAPI.createUser({ ...newAdmin, role: "admin", days: 3650, plan: "admin" })
                    .then(() => {
                      setNewAdmin({ name: "", email: "", password: "", role: "admin" });
                      setAdminMsg("Admin created");
                      return load();
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : "Could not create admin"));
                }}
              >
                <Input label="Full name" value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} />
                <Input label="Email" type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} />
                <Input label="Password" type="password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
                <Button type="submit"><Plus className="w-4 h-4" /> Create admin</Button>
              </form>
              {adminMsg && <p className="text-sm text-emerald-700">{adminMsg}</p>}
            </Card>
            <div className="flex-1 min-w-[220px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-9" />
              <Input className="pl-9" label="Search admins" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {loading && <Card>Loading admins…</Card>}
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUsers.map((account) => (
                <Card key={account.id} className="hover-lift">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-sky-50 border border-sky-100 flex-shrink-0">
                      {account.avatar ? (
                        <img src={account.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-sky-700">
                          {(account.name || "A").slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{account.name}</p>
                      <p className="text-xs text-slate-500 truncate">{account.email}</p>
                      <p className="text-xs font-mono text-brand mt-1">{account.userCode}</p>
                      <Badge variant={account.status === "active" ? "success" : "error"} className="mt-2">{account.status}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => openUser(account)}>Open</Button>
                    <Button size="sm" variant={account.status === "active" ? "outline" : "primary"} onClick={() => void patch(account.id, { status: account.status === "active" ? "suspended" : "active" })}>
                      {account.status === "active" ? "Suspend" : "Activate"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            {!loading && !filteredUsers.length && <Card className="text-sm text-slate-500">No admin users yet.</Card>}
          </div>
        )
      )}

      {(view === "admin-requests" || view === "admin-jobs") && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  {["ID", "Customer", "Worker", "Service", "Amount", "Location", "When", "Status"].map((h) => (
                    <th key={h} className="text-left font-semibold px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td className="px-4 py-5" colSpan={8}>Loading…</td></tr>}
                {!loading && requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{r.code}</td>
                    <td className="px-4 py-3">{r.customer?.name || "—"}</td>
                    <td className="px-4 py-3">{r.provider?.name || "Unassigned"}</td>
                    <td className="px-4 py-3">{r.category}</td>
                    <td className="px-4 py-3 font-semibold">₹{r.workerQuote || r.estimatedAmount || 0}</td>
                    <td className="px-4 py-3">{[r.area, r.city].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3">{r.scheduledLabel || r.timing}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === "admin-categories" && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <h2 className="font-display font-bold text-lg">Add a category</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <Input label="Description" value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} />
            </div>
            <p className="text-sm font-medium text-slate-700">Choose an icon</p>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
              {CATEGORY_ICONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => setNewCat({ ...newCat, icon: item.id })}
                  className={`h-12 rounded-xl border flex items-center justify-center ${newCat.icon === item.id ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-600 hover:border-brand"}`}
                >
                  <item.Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    void uploadImage(file).then(({ url }) => setNewCat((c) => ({ ...c, icon: url })));
                  };
                  input.click();
                }}
              >
                Upload custom icon
              </Button>
              <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center border border-sky-100">
                <CategoryIcon icon={newCat.icon} className="w-6 h-6" />
              </div>
              <Button onClick={() => void CategoryAPI.create(newCat).then(() => { setNewCat({ name: "", icon: "wrench", description: "" }); return load(); })}>Add category</Button>
            </div>
          </Card>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {categories.map((c) => (
              <Card key={c._id} className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center flex-shrink-0">
                    <CategoryIcon icon={c.icon} className="w-6 h-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.description || "No description"}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {CATEGORY_ICONS.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center ${c.icon === item.id ? "border-brand bg-brand-soft" : "border-slate-100"}`}
                          onClick={() => void CategoryAPI.patch(c._id, { icon: item.id }).then(() => load())}
                        >
                          <item.Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className={`w-12 h-7 rounded-full relative flex-shrink-0 ${c.active ? "bg-brand" : "bg-slate-300"}`}
                  onClick={() => void CategoryAPI.patch(c._id, { active: !c.active }).then(() => load())}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${c.active ? "left-5" : "left-0.5"}`} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {view === "admin-services" && (
        <div className="space-y-3">
          {categories.map((c) => (
            <Card key={c._id}>
              <p className="font-semibold mb-2 flex items-center gap-2"><CategoryIcon icon={c.icon} className="w-5 h-5" /> {c.name}</p>
              <div className="flex flex-wrap gap-2">
                {(c.services || []).map((s) => (
                  <Badge key={s.name} variant="info">{s.name} · {money(s.priceFrom)}</Badge>
                ))}
                {!c.services?.length && <p className="text-sm text-slate-500">No services listed.</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === "admin-complaints" && (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{["Code", "Type", "Subject", "Status", "Action"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complaints.map((c) => (
                <tr key={c._id}>
                  <td className="px-4 py-3 font-medium">{c.code}</td>
                  <td className="px-4 py-3 capitalize">{c.party}</td>
                  <td className="px-4 py-3">{c.subject}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void AdminAPI.patchComplaint(c._id, { status: "investigating" }).then(() => load())}>Investigate</Button>
                      <Button size="sm" onClick={() => void AdminAPI.patchComplaint(c._id, { status: "resolved" }).then(() => load())}>Resolve</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {view === "admin-reviews" && (
        <Card padding="none">
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-semibold">{r.rating}/5</span>
                  <span className="text-slate-400 text-xs">{when(r.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-800">{r.comment || "No comment"}</p>
                <p className="text-xs text-slate-500 mt-1">{r.customer} → {r.provider}</p>
              </div>
            ))}
            {!reviews.length && <p className="p-5 text-sm text-slate-500">No reviews yet.</p>}
          </div>
        </Card>
      )}

      {view === "admin-notifications" && (
        <div className="space-y-4">
          <Card className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full"><Input label="Broadcast message" value={broadcast} onChange={(e) => setBroadcast(e.target.value)} /></div>
            <Button onClick={() => void AdminAPI.broadcast({ text: broadcast, role: "all" }).then(() => { setBroadcast(""); return load(); })}>Send to everyone</Button>
          </Card>
          <Card padding="none">
            <div className="divide-y divide-slate-100">
              {notifs.map((n) => (
                <div key={n._id} className="px-5 py-3 text-sm">
                  <p>{n.text}</p>
                  <p className="text-xs text-slate-400">{when(n.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {view === "admin-transactions" && (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Kpi label="Payments" value={money(totals.payment || 0)} />
            <Kpi label="Provider earnings" value={money(totals.payout || 0)} />
            <Kpi label="Refunds" value={money(totals.refund || 0)} />
          </div>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{["Txn ID", "Type", "Amount", "Status", "Date"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txns.map((t) => (
                  <tr key={t._id}>
                    <td className="px-4 py-3 font-medium">{t.code}</td>
                    <td className="px-4 py-3 capitalize">{t.kind}</td>
                    <td className="px-4 py-3">{money(t.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3">{when(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {view === "admin-analytics" && (
        <AnalyticsDashboard
          title=""
          revenue={overview?.revenue || 0}
          revenueHint={overview?.customerGrowth != null ? `${overview.customerGrowth >= 0 ? "+" : ""}${overview.customerGrowth}% customers this week` : undefined}
          newUsers={(analytics?.byDay || []).reduce((s, d) => s + (d.users || 0), 0)}
          usersHint="Last 14 days"
          active={overview?.activeJobs || 0}
          activeHint="Accepted, scheduled, in progress"
          cancelled={(overview?.byStatus?.cancelled || 0) + (overview?.byStatus?.declined || 0)}
          cancelledHint="Cancelled + declined"
          byDay={analytics?.byDay || []}
          byCategory={analytics?.byCategory || []}
          byCity={analytics?.byCity || []}
          byStatus={overview?.byStatus || {}}
          activity={(overview?.recentActivity || []).map((a) => ({ id: a.id, text: a.text, at: a.at }))}
        />
      )}

      {view === "admin-licenses" && (
        <div className="space-y-4">
          <Card className="flex flex-wrap gap-3 items-end">
            <Input label="Duration (days)" type="number" value={licDays} onChange={(e) => setLicDays(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Plan</label>
              <select className="px-4 py-3 rounded-xl border border-slate-200 text-sm" value={licPlan} onChange={(e) => setLicPlan(e.target.value)}>
                <option value="trial">trial</option>
                <option value="standard">standard</option>
                <option value="pro">pro</option>
                <option value="business">business</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 pb-2">Pick a user below, then Grant. This controls their login period.</p>
          </Card>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{["User ID", "Name", "Role", "Plan", "Days left", "Expires", "Action"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {licenseRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{row.userCode || "—"}</td>
                    <td className="px-4 py-3">{row.name}<br /><span className="text-xs text-slate-400">{row.email}</span></td>
                    <td className="px-4 py-3">{roleLabel(row.role)}</td>
                    <td className="px-4 py-3">{row.license?.plan}</td>
                    <td className="px-4 py-3"><Badge variant={row.license?.status === "active" ? "success" : "warning"}>{row.license?.remainingDays ?? 0}d · {row.license?.status}</Badge></td>
                    <td className="px-4 py-3">{row.license?.expiresAt ? new Date(row.license.expiresAt).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void AdminAPI.grantLicense(row.id, { days: Number(licDays), plan: licPlan }).then(() => load())}>Grant</Button>
                        <Button size="sm" variant="outline" onClick={() => void AdminAPI.revokeLicense(row.id).then(() => load())}>Revoke</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {view === "admin-audit" && (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{["Admin", "Action", "Target", "IP", "When"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="px-4 py-3">{l.adminName}</td>
                  <td className="px-4 py-3">{l.action}</td>
                  <td className="px-4 py-3">{l.target || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{l.ip || "—"}</td>
                  <td className="px-4 py-3">{when(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {view === "admin-settings" && settings && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="space-y-4">
            <h2 className="font-semibold">Platform settings</h2>
            <label className="flex items-center justify-between text-sm">
              Allow new registrations
              <input type="checkbox" className="accent-brand" checked={settings.allowRegistrations} onChange={(e) => void AdminAPI.patchSettings({ allowRegistrations: e.target.checked }).then((r) => setSettings(r.settings))} />
            </label>
            <label className="flex items-center justify-between text-sm">
              Auto-approve providers
              <input type="checkbox" className="accent-brand" checked={settings.autoApproveProviders} onChange={(e) => void AdminAPI.patchSettings({ autoApproveProviders: e.target.checked }).then((r) => setSettings(r.settings))} />
            </label>
            <Input label="Support email" value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} />
            <p className="text-xs text-slate-400">Shown on Contact support. Click opens this inbox. Default: {SUPPORT_EMAIL}</p>
            <Input
              label="Google Client ID"
              placeholder="xxxx.apps.googleusercontent.com"
              value={settings.googleClientId || ""}
              onChange={(e) => setSettings({ ...settings, googleClientId: e.target.value })}
            />
            <p className="text-xs text-slate-400">
              Web client ID from Google Cloud → APIs &amp; Services → Credentials. Authorized JavaScript origins must include
              https://fixbuddy-ivory.vercel.app and http://localhost:5173. Do not use an Android/iOS client ID.
            </p>
            <Input label="Commission %" type="number" value={settings.commissionPercent} onChange={(e) => setSettings({ ...settings, commissionPercent: Number(e.target.value) })} />
            <Button onClick={() => void AdminAPI.patchSettings({ ...settings, smtpPass: settings.smtpPass || undefined }).then((r) => { setSettings(r.settings); setPendingMail(r.pendingMail || 0); })}>Save settings</Button>
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Worker cancellation compensation</h3>
              <p className="text-xs text-slate-500">Applied only when a customer cancels after the worker starts travelling.</p>
              <Input label="Travel compensation ₹" type="number" min="0" value={String(settings.cancellationPolicy?.workerTravelCompensation ?? 75)} onChange={(e) => setSettings({ ...settings, cancellationPolicy: { ...settings.cancellationPolicy, workerTravelCompensation: Number(e.target.value) } })} />
              <Input label="Travel started after minutes" type="number" min="0" value={String(settings.cancellationPolicy?.workerTravelAfterMinutes ?? 5)} onChange={(e) => setSettings({ ...settings, cancellationPolicy: { ...settings.cancellationPolicy, workerTravelAfterMinutes: Number(e.target.value) } })} />
              <Button variant="outline" onClick={() => void AdminAPI.patchSettings({ cancellationPolicy: settings.cancellationPolicy }).then((r) => setSettings(r.settings))}>Save compensation policy</Button>
            </div>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-semibold">Gmail / OTP mail</h2>
            <p className="text-sm text-slate-600">OTP cron runs every 20 seconds. Add a Gmail app password here so forgot-password mail is delivered.</p>
            <p className="text-xs text-slate-500">Pending OTP emails: {pendingMail}</p>
            <Input label="SMTP host" value={settings.smtpHost || "smtp.gmail.com"} onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })} />
            <Input label="SMTP port" type="number" value={settings.smtpPort || 465} onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })} />
            <Input label="Gmail address" value={settings.smtpUser || ""} onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })} />
            <Input
              label={settings.smtpPassSet ? "Gmail app password (saved — paste to replace)" : "Gmail app password"}
              type="password"
              placeholder={settings.smtpPassSet ? "********" : "16-character Google app password"}
              value={settings.smtpPass || ""}
              onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
            />
            {mailMsg && <p className="text-sm text-emerald-700">{mailMsg}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void AdminAPI.patchSettings({ ...settings, smtpPass: settings.smtpPass || undefined }).then((r) => { setSettings(r.settings); setPendingMail(r.pendingMail || 0); setMailMsg("Mail settings saved. Cron will send queued OTPs."); })}>
                Save mail settings
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMailMsg("");
                  void AdminAPI.testMail(settings.supportEmail)
                    .then((r) => setMailMsg(r.message))
                    .catch((e: Error) => setMailMsg(e.message));
                }}
              >
                Send test mail
              </Button>
            </div>
          </Card>
        </div>
      )}
      {view === "admin-settings" && (
        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full lg:hidden flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 font-medium text-sm hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, loading, tone, icon }: { label: string; value?: React.ReactNode; hint?: string; loading?: boolean; tone?: "warn"; icon?: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`p-2 rounded-xl ${tone === "warn" ? "bg-amber-50 text-amber-600" : "bg-brand-soft text-brand"}`}>{icon || <TrendingUp className="w-4 h-4" />}</span>
      </div>
      {loading ? <Skeleton className="mt-3 h-9 w-16" /> : <p className="mt-2 text-3xl font-bold text-slate-900 font-display">{value ?? 0}</p>}
      {hint && <p className="text-xs text-emerald-600 mt-1 inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {hint}</p>}
    </Card>
  );
}

function BarRow({ items, fallback = 1 }: { items: { label: string; value: number }[]; fallback?: number }) {
  const max = Math.max(fallback, ...items.map((i) => i.value), 1);
  if (!items.length) return <p className="text-sm text-slate-500">Not enough data yet. Open this after jobs start flowing.</p>;
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((i) => (
        <div key={i.label}>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="truncate mr-2">{i.label}</span>
            <span>{i.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(6, (i.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function UserTable({
  users,
  loading,
  onPatch,
  onOpen,
  showVerify = false,
}: {
  users: AppUser[];
  loading: boolean;
  onPatch: (id: string, body: object) => Promise<void>;
  onOpen: (u: AppUser) => void;
  showVerify?: boolean;
}) {
  if (loading) return <div className="p-5 text-sm text-slate-500">Loading users…</div>;
  if (users.length === 0) return <div className="p-5 text-sm text-slate-500">No accounts found.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {["Name", "User ID", "Contact", "Location", "Requests", "Completed", "Status", "Actions"].map((h) => (
              <th key={h} className="text-left font-semibold px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((account) => (
            <tr key={account.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <button className="text-left" onClick={() => onOpen(account)}>
                  <p className="font-medium text-slate-900">{account.provider?.businessName || account.name}</p>
                  <p className="text-xs text-slate-400">{roleLabel(account.role)}</p>
                </button>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{account.userCode || "—"}</td>
              <td className="px-4 py-3">
                <p>{account.phone || "—"}</p>
                <p className="text-xs text-slate-400">{account.email}</p>
              </td>
              <td className="px-4 py-3">{[account.area, account.city].filter(Boolean).join(", ") || "—"}</td>
              <td className="px-4 py-3">{account.requestCount ?? "—"}</td>
              <td className="px-4 py-3">{account.completedCount ?? account.provider?.completedJobs ?? "—"}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant={account.status === "active" ? "success" : "error"}>{account.status}</Badge>
                  {showVerify && (
                    <Badge variant={account.provider?.verified ? "success" : "warning"}>
                      {account.provider?.verified ? "Verified" : "Pending"}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void onPatch(account.id, { status: account.status === "active" ? "suspended" : "active" })}>
                    {account.status === "active" ? "Suspend" : "Activate"}
                  </Button>
                  {showVerify && !account.provider?.verified && (
                    <Button size="sm" onClick={() => void onPatch(account.id, { verified: true })}>Verify</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserDetail({
  user,
  requests,
  onBack,
  onPatch,
  onReload,
}: {
  user: AppUser;
  requests: JobRequest[];
  onBack: () => void;
  onPatch: (id: string, body: object) => Promise<void>;
  onReload?: () => void;
}) {
  const [tab, setTab] = useState("Profile");
  const [days, setDays] = useState("30");
  const docs = [
    ["GST Certificate", user.provider?.gstCertificate],
    ["Aadhaar Card", user.provider?.aadhaarCard],
    ["PAN Card", user.provider?.panCard],
  ].filter(([, url]) => url);
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-brand">← Back to list</button>
      <Card className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          {user.avatar ? <img src={user.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" /> : <div className="w-16 h-16 rounded-2xl bg-brand-soft" />}
          <div>
            <h2 className="text-xl font-bold font-display">{user.provider?.businessName || user.name}</h2>
            <p className="text-xs font-mono text-brand mt-0.5">{user.userCode || user.id}</p>
            <p className="text-sm text-slate-500">{user.email} · {user.phone}</p>
            <p className="text-xs text-slate-400 inline-flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {[user.area, user.city].filter(Boolean).join(", ")}</p>
            {user.lat != null && user.lng != null && (
              <a className="block text-xs text-brand mt-1" href={`https://www.google.com/maps?q=${user.lat},${user.lng}`} target="_blank" rel="noreferrer">Open live location</a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={user.status === "active" ? "success" : "error"}>{user.status}</Badge>
          {user.provider && <Badge variant={user.provider.verified ? "success" : "warning"}>{user.provider.verified ? "Verified" : "Pending"}</Badge>}
        </div>
      </Card>
      <div className="flex gap-2 flex-wrap">
        {["Profile", "License", "Requests", "Jobs", "Documents"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === t ? "bg-brand text-white" : "bg-white border border-slate-200"}`}>{t}</button>
        ))}
      </div>
      {tab === "Profile" && (
        <Card className="grid sm:grid-cols-2 gap-3 text-sm">
          <p><span className="text-slate-400">User ID</span><br /><span className="font-mono">{user.userCode}</span></p>
          <p><span className="text-slate-400">Name</span><br />{user.name}</p>
          <p><span className="text-slate-400">Role</span><br />{roleLabel(user.role)}</p>
          <p><span className="text-slate-400">Address</span><br />{user.address || "—"}</p>
          <p><span className="text-slate-400">Hours</span><br />{user.provider?.hours?.from} – {user.provider?.hours?.to}</p>
          <p className="sm:col-span-2"><span className="text-slate-400">About</span><br />{user.provider?.description || "—"}</p>
          <div className="sm:col-span-2 flex gap-2">
            <Button variant="outline" onClick={() => void onPatch(user.id, { status: user.status === "active" ? "suspended" : "active" })}>{user.status === "active" ? "Suspend" : "Activate"}</Button>
            {user.provider && !user.provider.verified && <Button onClick={() => void onPatch(user.id, { verified: true })}>Approve verification</Button>}
          </div>
        </Card>
      )}
      {tab === "License" && (
        <Card className="space-y-3">
          <p className="text-sm">Plan <strong>{user.license?.plan}</strong> · {user.license?.remainingDays ?? 0} days left · {user.license?.status}</p>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-brand rounded-full" style={{ width: `${user.license?.percent ?? 0}%` }} />
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Input label="Days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
            <Button onClick={() => void AdminAPI.grantLicense(user.id, { days: Number(days), plan: "pro" }).then(() => onReload?.())}>Grant / extend</Button>
            <Button variant="outline" onClick={() => void AdminAPI.revokeLicense(user.id).then(() => onReload?.())}>Revoke login</Button>
          </div>
        </Card>
      )}
      {(tab === "Requests" || tab === "Jobs") && (
        <Card padding="none">
          {requests.filter((r) => (tab === "Jobs" ? ["accepted", "scheduled", "in_progress", "completed", "reviewed"].includes(r.status) : true)).map((r) => (
            <div key={r.id} className="px-5 py-3 border-b border-slate-100 flex justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{r.code} · {r.category}</p>
                <p className="text-xs text-slate-500 line-clamp-1">{r.description}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </Card>
      )}
      {tab === "Documents" && (
        <div className="grid sm:grid-cols-3 gap-3">
          {docs.map(([name, url]) => (
            <Card key={String(name)} padding="sm">
              <p className="text-xs text-slate-500 mb-2">{name}</p>
              <img src={String(url)} alt={String(name)} className="w-full h-32 object-cover rounded-xl" />
            </Card>
          ))}
          {!docs.length && <p className="text-sm text-slate-500">No documents uploaded.</p>}
        </div>
      )}
    </div>
  );
}
