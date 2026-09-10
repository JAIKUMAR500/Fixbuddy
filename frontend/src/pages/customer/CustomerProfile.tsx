import React, { useRef, useState } from "react";
import { ChevronRight, Camera, LogOut, Bell, Shield, Lock, Globe, Loader2 } from "lucide-react";
import { View } from "../../types";
import { Button, Card, Avatar } from "../../components/ui";
import { useApp, useFetch } from "../../api/AppContext";
import { AuthAPI, uploadImage, type JobRequest } from "../../api/client";
import { UserIdCard } from "../shared/AccountModules";
import { displayName } from "../../api/display";

export default function CustomerProfile({ navigate }: { navigate: (v: View) => void }) {
  const { user, setUser, logout } = useApp();
  const { data } = useFetch<{ requests: JobRequest[] }>("/requests");
  const rows = data?.requests || [];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { icon: <Bell className="w-4 h-4" />, label: "Notifications", action: () => navigate("customer-notifications") },
    { icon: <Globe className="w-4 h-4" />, label: "Language & Location", action: () => navigate("customer-settings") },
    { icon: <Shield className="w-4 h-4" />, label: "Privacy", action: () => navigate("customer-settings") },
    { icon: <Lock className="w-4 h-4" />, label: "Security", action: () => navigate("customer-settings") },
  ];

  const changePhoto = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const { url } = await uploadImage(file);
      const { user: next } = await AuthAPI.updateMe({ avatar: url });
      setUser(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setSaving(false);
    }
  };

  const homeAddress = [user?.address, user?.area, user?.city].filter(Boolean).join(", ");

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 pb-24 space-y-5 animate-slide-up">
      <UserIdCard />
      <Card padding="lg">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <Avatar src={user?.avatar} name={user?.name || "You"} size="2xl" className="rounded-3xl" />
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void changePhoto(e.target.files?.[0])} />
            <button type="button" onClick={() => photoRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 bg-sky-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-sky-700 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          {editing ? (
            <div className="w-full space-y-3 text-left">
              <div>
                <label className="text-xs font-medium text-slate-600">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-sky-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-sky-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input value={user?.email || ""} readOnly className="w-full mt-1 px-3 py-2 rounded-xl border border-sky-200 text-sm bg-slate-50" />
              </div>
              <div className="flex gap-3">
                <Button variant="primary" size="sm" fullWidth loading={saving} onClick={async () => {
                  setSaving(true);
                  setError("");
                  try {
                    const { user: next } = await AuthAPI.updateMe({ name, phone });
                    setUser(next);
                    setEditing(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save");
                  } finally {
                    setSaving(false);
                  }
                }}>Save Changes</Button>
                <Button variant="ghost" size="sm" fullWidth onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>{displayName(user)}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{user?.email}</p>
              <p className="text-slate-500 text-sm">{user?.phone || "Add a phone number"}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
            </>
          )}
        </div>
        {!editing && (
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-sky-50">
            {[
              { label: "Requests", value: String(rows.length) },
              { label: "Completed", value: String(rows.filter((r) => ["completed", "reviewed", "payment_collected", "customer_completed"].includes(r.status)).length) },
              { label: "Active", value: String(rows.filter((r) => ["matching", "open", "requested", "accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress"].includes(r.status)).length) },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-bold text-xl text-sky-700" style={{ fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 text-sm">Saved Addresses</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-sky-50 last:border-0">
            <div>
              <p className="text-sm font-medium text-slate-800">🏠 Home</p>
              <p className="text-xs text-slate-500">{homeAddress || "Add your address from a new request"}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </Card>

      <Card padding="md">
        <h3 className="font-semibold text-slate-900 text-sm mb-3">Preferences & Account</h3>
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-sky-50 transition-colors text-left"
            >
              <span className="p-2 bg-sky-50 text-sky-600 rounded-lg">{item.icon}</span>
              <span className="flex-1 text-sm font-medium text-slate-800">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>
      </Card>

      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}
