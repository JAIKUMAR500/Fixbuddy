import React, { useState } from "react";
import { View } from "../../types";
import { Badge, Button, Card, EmptyState, Input, StatusBadge } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { AuthAPI, ProviderAPI, type JobRequest, type ReviewsPayload, type ServiceCategory } from "../../api/client";
import { serviceLabel, servicePrice } from "../../api/display";
import { useLang } from "../../i18n/LangContext";
import CategoryIcon from "../../components/CategoryIcon";

export function CustomerBookings({ navigate }: { navigate: (v: View) => void }) {
  const { setActiveRequestId } = useApp();
  const { data, loading } = useFetch<{ requests: JobRequest[] }>("/requests");
  const [tab, setTab] = useState("All");
  const rows = (data?.requests || []).filter((r) => {
    if (tab === "Upcoming") return ["accepted", "scheduled"].includes(r.status);
    if (tab === "In Progress") return r.status === "in_progress";
    if (tab === "Completed") return ["completed", "reviewed"].includes(r.status);
    if (tab === "Cancelled") return ["cancelled", "declined"].includes(r.status);
    return true;
  });

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold font-display mb-2">Bookings</h1>
      <p className="text-slate-500 text-sm mb-6">Upcoming, in progress and completed jobs.</p>
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
        {["All", "Upcoming", "In Progress", "Completed", "Cancelled"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === t ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{t}</button>
        ))}
      </div>
      {loading && <Card className="text-sm text-slate-500">Loading bookings...</Card>}
      {!loading && rows.length === 0 && (
        <EmptyState icon="📅" title="No bookings yet" description="When a provider accepts your request, it appears here." actionLabel="Find a Service" onAction={() => navigate("create-request")} />
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="cursor-pointer hover:border-brand" onClick={() => { setActiveRequestId(r.id); navigate("request-status"); }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.category}</p>
                <p className="text-xs text-slate-500">{r.provider?.name || "Finding a worker"} · {r.scheduledLabel || r.timing}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CustomerReviewsPage() {
  const { data, loading } = useFetch<ReviewsPayload>("/reviews");
  const rows = data?.reviews || [];
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold font-display mb-2">Reviews & Ratings</h1>
      <p className="text-slate-500 text-sm mb-6">Ratings from jobs you completed.</p>
      {data && (
        <Card className="mb-5 bg-amber-50 border-amber-200">
          <p className="font-display text-4xl font-black text-amber-600">{data.ratingAvg || 0}</p>
          <p className="text-sm text-slate-600 mt-1">{data.ratingCount || 0} reviews</p>
        </Card>
      )}
      {loading && <p className="text-sm text-slate-500">Loading reviews...</p>}
      {!loading && rows.length === 0 && <EmptyState icon="⭐" title="No reviews yet" description="Complete a job to rate your provider." />}
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="hover-lift">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-sky-50 border border-sky-100">
                {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div>
                <p className="font-semibold">{r.customer}</p>
                <p className="text-xs text-slate-400">{r.date} · {r.rating}/5</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">{r.comment || "Rated without a comment."}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ProviderServices() {
  const { user, setUser } = useApp();
  const { t } = useLang();
  const { data: catData } = useFetch<{ categories: ServiceCategory[] }>("/categories");
  const raw = user?.provider?.services || [];
  const services = raw.map((s, i) => ({
    key: `${serviceLabel(s)}-${i}`,
    name: serviceLabel(s),
    price: servicePrice(s, user?.provider?.startingPrice || 0),
  }));
  const [draft, setDraft] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [category, setCategory] = useState(user?.provider?.category || "");
  const [startingPrice, setStartingPrice] = useState(String(user?.provider?.startingPrice || ""));
  const [hoursFrom, setHoursFrom] = useState(user?.provider?.hours?.from || "08:00");
  const [hoursTo, setHoursTo] = useState(user?.provider?.hours?.to || "20:00");

  const payload = (rows: { name: string; price: number }[]) =>
    rows.map((r) => ({ name: r.name, price: r.price }));

  const save = async (next: { name: string; price: number }[]) => {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const { user: u } = await ProviderAPI.update({ services: payload(next) });
      setUser(u);
      setOk("Services saved");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save services");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addService = async () => {
    const name = draft.trim();
    if (!name) {
      setError("Type a service name, then tap Add.");
      return;
    }
    if (services.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setError("That service is already on your list.");
      return;
    }
    const ok = await save([...services.map((s) => ({ name: s.name, price: s.price })), { name, price: Number(price || user?.provider?.startingPrice || 0) }]);
    if (ok) {
      setDraft("");
      setPrice("");
    }
  };

  const saveDetails = async () => {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const { user: u } = await ProviderAPI.update({
        category,
        startingPrice: Number(startingPrice || 0),
        hours: { from: hoursFrom, to: hoursTo },
      });
      setUser(u);
      setOk("Service details saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto pb-24 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display">{t("services.title")}</h1>
        <p className="text-sm text-slate-500">{t("services.sub")}</p>
      </div>
      <Card className="space-y-4 mb-6">
        <h2 className="font-semibold text-slate-900">Category, price and hours</h2>
        <label className="block text-sm">
          <span className="text-slate-600">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full min-h-12 rounded-xl border border-slate-200 px-3 bg-white"
          >
            <option value="">Select a category</option>
            {(catData?.categories || []).map((c) => (
              <option key={c._id} value={c.name}>{c.name}</option>
            ))}
            {category && !(catData?.categories || []).some((c) => c.name === category) && (
              <option value={category}>{category}</option>
            )}
          </select>
        </label>
        <Input label="Starting price ₹" type="number" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Opens" type="time" value={hoursFrom} onChange={(e) => setHoursFrom(e.target.value)} />
          <Input label="Closes" type="time" value={hoursTo} onChange={(e) => setHoursTo(e.target.value)} />
        </div>
        <Button size="lg" loading={saving} onClick={() => void saveDetails()}>Save details</Button>
      </Card>
      <form
        className="grid sm:grid-cols-[1fr_140px_auto] gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          void addService();
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("services.name")} />
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t("services.price")} />
        <Button type="submit" size="lg" className="min-h-12" loading={saving}>{t("common.add")}</Button>
      </form>
      {ok && <p className="text-sm text-emerald-700 mb-3">{ok}</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <div className="space-y-3">
        {services.map((s, i) => (
          <Card key={s.key} className="flex flex-col sm:flex-row sm:items-center gap-3">
            {editing === i ? (
              <>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" loading={saving} onClick={() => {
                    const next = services.map((row, idx) => idx === i ? { name: editName.trim() || row.name, price: Number(editPrice || row.price) } : { name: row.name, price: row.price });
                    void save(next).then((ok) => ok && setEditing(null));
                  }}>{t("common.save")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-slate-500">₹{s.price} · {user?.provider?.category || "Your category"}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setEditing(i); setEditName(s.name); setEditPrice(String(s.price)); }}>{t("common.edit")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => void save(services.filter((_, idx) => idx !== i).map((row) => ({ name: row.name, price: row.price })))}>{t("common.delete")}</Button>
                </div>
              </>
            )}
          </Card>
        ))}
        {!services.length && <p className="text-sm text-slate-500">No services yet. Add one above.</p>}
      </div>
    </div>
  );
}

export function ProviderSettings() {
  const { user, setUser } = useApp();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold font-display">Settings</h1>
      <Card className="space-y-4">
        <h2 className="font-semibold">Account</h2>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" value={user?.email || ""} readOnly />
        <Button loading={saving} onClick={async () => {
          setSaving(true);
          try {
            const { user: next } = await AuthAPI.updateMe({ name });
            setUser(next);
          } finally {
            setSaving(false);
          }
        }}>Save changes</Button>
      </Card>
    </div>
  );
}

export function AdminSimple({ title, body }: { title: string; body: string }) {
  const { data } = useFetch<{ categories: ServiceCategory[] }>("/categories");
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold font-display mb-2">{title}</h1>
      <Card>
        <p className="text-sm text-slate-500">{body}</p>
        {title === "Categories" && (
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            {(data?.categories || []).map((c) => (
              <div key={c._id} className="border border-slate-200 rounded-2xl p-4">
                <CategoryIcon icon={c.icon} className="w-8 h-8 text-brand" />
                <p className="font-semibold mt-2">{c.name}</p>
                <Badge variant="info" className="mt-2">{c.active ? "Active" : "Hidden"}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
