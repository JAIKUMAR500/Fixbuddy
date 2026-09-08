import React, { useState } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { Button, Card, Input, Textarea } from "./ui";
import { useApp } from "../api/AppContext";
import { AuthAPI } from "../api/client";
import { capturePlace } from "../api/geo";
import { useLang } from "../i18n/LangContext";

export default function ProfilePrompt() {
  const { user, setUser } = useApp();
  const { t } = useLang();
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [jobType, setJobType] = useState(user?.jobType || "");
  const [studies, setStudies] = useState(user?.studies || "");
  const [address, setAddress] = useState(user?.address || "");
  const [aadhaar, setAadhaar] = useState(user?.aadhaar || "");
  const [pan, setPan] = useState(user?.pan || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const finish = async (skip: boolean) => {
    setBusy(skip ? "skip" : "save");
    setError("");
    try {
      const body = skip
        ? { profileAsked: true }
        : {
            profileAsked: true,
            phone,
            address,
            age: age ? Number(age) : undefined,
            jobType,
            studies,
            aadhaar,
            pan,
          };
      const { user: next } = await AuthAPI.updateMe(body);
      setUser(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy("");
    }
  };

  const grabGps = async () => {
    setBusy("gps");
    setError("");
    try {
      const place = await capturePlace();
      setAddress(place.address || address);
      const { user: next } = await AuthAPI.updateMe({
        lat: place.lat,
        lng: place.lng,
        city: place.city || user?.city,
        area: place.area || user?.area,
        address: place.address || address,
      });
      setUser(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read GPS");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <Card className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-2xl bg-brand-soft text-brand flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold font-display">{t("prompt.title")}</h2>
            <p className="text-sm text-slate-500 mt-1">{t("prompt.sub")}</p>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label={t("prompt.age")} type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          <Input label={t("prompt.phone")} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Input label={t("prompt.job")} value={jobType} onChange={(e) => setJobType(e.target.value)} placeholder="e.g. AC technician, electrician" />
        <Input label={t("prompt.studies")} value={studies} onChange={(e) => setStudies(e.target.value)} />
        <Textarea label={t("prompt.address")} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Button variant="secondary" fullWidth loading={busy === "gps"} onClick={() => void grabGps()}>
          <MapPin className="w-4 h-4" /> {t("prompt.gps")}
        </Button>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label={t("prompt.aadhaar")} value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} />
          <Input label={t("prompt.pan")} value={pan} onChange={(e) => setPan(e.target.value)} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button variant="ghost" fullWidth loading={busy === "skip"} onClick={() => void finish(true)}>
            {t("common.skip")}
          </Button>
          <Button fullWidth size="lg" loading={busy === "save"} onClick={() => void finish(false)}>
            {t("common.save")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
