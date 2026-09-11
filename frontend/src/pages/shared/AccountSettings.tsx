import React, { useState } from "react";
import { Bell, Globe, Lock, MapPin, Shield, User, Loader2, Camera, LogOut } from "lucide-react";
import { Button, Card, Input, Textarea, SafeImg } from "../../components/ui";
import { useApp } from "../../api/AppContext";
import { AuthAPI, uploadImage } from "../../api/client";
import { capturePlace } from "../../api/geo";
import { UserIdCard } from "./AccountModules";
import { useLang, LANGS } from "../../i18n/LangContext";

export default function AccountSettings() {
  const { user, setUser, logout } = useApp();
  const { t, lang, setLang } = useLang();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [area, setArea] = useState(user?.area || "");
  const [address, setAddress] = useState(user?.address || "");
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [jobType, setJobType] = useState(user?.jobType || "");
  const [studies, setStudies] = useState(user?.studies || "");
  const [aadhaar, setAadhaar] = useState(user?.aadhaar || "");
  const [pan, setPan] = useState(user?.pan || "");
  const [saving, setSaving] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState(true);
  const [sms, setSms] = useState(true);
  const photoRef = React.useRef<HTMLInputElement>(null);

  const changePhoto = async (file?: File) => {
    if (!file) return;
    setSaving("photo");
    setError("");
    try {
      const { url } = await uploadImage(file);
      const { user: next } = await AuthAPI.updateMe({ avatar: url });
      setUser(next);
      setMsg("Photo saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setSaving("");
    }
  };

  const saveProfile = async () => {
    setSaving("profile");
    setError("");
    try {
      const { user: next } = await AuthAPI.updateMe({
        name,
        phone,
        city,
        area,
        address,
        age: age ? Number(age) : undefined,
        jobType,
        studies,
        aadhaar,
        pan,
        lang,
      });
      setUser(next);
      setMsg("Profile saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving("");
    }
  };

  const saveLocation = async () => {
    setSaving("gps");
    setError("");
    try {
      const place = await capturePlace();
      const { user: next } = await AuthAPI.updateMe({
        lat: place.lat,
        lng: place.lng,
        city: place.city || city,
        area: place.area || area,
        address: place.address || address,
      });
      setUser(next);
      setCity(next.city);
      setArea(next.area);
      setAddress(next.address);
      setMsg("Current location saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read GPS");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Settings</h1>
        <p className="text-sm text-slate-500">Account, location and how we contact you.</p>
      </div>
      <UserIdCard />
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{msg}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <Card className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4 text-brand" /> Profile</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-sky-100 shadow-sm bg-sky-50">
              {user?.avatar ? (
                <SafeImg src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-sky-700">
                  {(user?.name || "U").slice(0, 1)}
                </div>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void changePhoto(e.target.files?.[0])} />
            <button type="button" onClick={() => photoRef.current?.click()} className="absolute -bottom-1 -right-1 w-9 h-9 bg-sky-600 text-white rounded-full flex items-center justify-center shadow-md">
              {saving === "photo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{user?.name}</p>
            <p className="text-sm text-slate-500">Tap the camera to update your photo</p>
          </div>
        </div>
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email" value={user?.email || ""} readOnly />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Age (optional)" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          <Input label="Type of job (optional)" value={jobType} onChange={(e) => setJobType(e.target.value)} />
        </div>
        <Input label="Studies (optional)" value={studies} onChange={(e) => setStudies(e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Aadhaar (optional)" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} />
          <Input label="PAN (optional)" value={pan} onChange={(e) => setPan(e.target.value)} />
        </div>
        <Button size="lg" loading={saving === "profile"} onClick={() => void saveProfile()}>Save profile</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-brand" /> Location</h2>
        <p className="text-sm text-slate-500">Used to suggest the nearest available workers.</p>
        <Button variant="secondary" size="lg" loading={saving === "gps"} onClick={() => void saveLocation()}>
          {saving === "gps" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          Use current location
        </Button>
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input label="Area" value={area} onChange={(e) => setArea(e.target.value)} />
        <Textarea label="Address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        <p className="text-xs text-slate-400">{user?.lat != null ? `GPS ${user.lat.toFixed(4)}, ${user.lng?.toFixed(4)}` : "GPS not saved yet"}</p>
        <Button size="lg" loading={saving === "profile"} onClick={() => void saveProfile()}>Save address</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-brand" /> Language</h2>
        <p className="text-sm text-slate-500">App language for menus, job actions and notifications.</p>
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map(({ id }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                const prev = lang;
                setLang(id);
                setError("");
                void AuthAPI.updateMe({ lang: id })
                  .then((d) => {
                    setUser(d.user);
                    setMsg(id === "en" ? "Language saved: English" : id === "ta" ? "மொழி சேமிக்கப்பட்டது: தமிழ்" : "भाषा सेव हुई: हिन्दी");
                  })
                  .catch((e) => {
                    setLang(prev);
                    setError(e instanceof Error ? e.message : "Could not save language");
                  });
              }}
              className={`min-h-12 rounded-xl border text-sm font-semibold ${lang === id ? "bg-brand text-white border-brand" : "bg-white border-slate-200 text-slate-700"}`}
            >
              {t(`lang.${id}`)}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4 text-brand" /> Notifications</h2>
        <label className="flex items-center justify-between text-sm min-h-12">
          Job and chat alerts
          <input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} className="w-5 h-5 accent-brand" />
        </label>
        <label className="flex items-center justify-between text-sm min-h-12">
          SMS updates
          <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} className="w-5 h-5 accent-brand" />
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-brand" /> Privacy</h2>
        <p className="text-sm text-slate-500">Your phone is shared only after a worker accepts your job, so you can call them.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-brand" /> Security</h2>
        <p className="text-sm text-slate-500">You are signed in as {user?.email}. License {user?.license?.status || "none"} · {user?.userCode}.</p>
      </Card>

      <button
        type="button"
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors lg:hidden"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}
