import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Image, MapPin, CheckCircle, Edit2, Loader2, X, IndianRupee } from "lucide-react";
import { View, RequestData } from "../../types";
import { Button, Input, Textarea, StepIndicator, Card } from "../../components/ui";
import { CategoryAPI, RequestAPI, mediaUrl, uploadImage } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { isBusiness } from "../../api/roles";
import { capturePlace } from "../../api/geo";
import { typicalPrice, guidePriceText } from "../../api/money";
import VoiceRecorder from "../../components/VoiceRecorder";
import CategoryIcon from "../../components/CategoryIcon";

const TIMINGS = [
  { id: "asap", label: "As soon as possible", icon: "⚡" },
  { id: "today", label: "Today", icon: "📅" },
  { id: "tomorrow", label: "Tomorrow", icon: "📆" },
  { id: "custom", label: "Choose date & time", icon: "🗓️" },
];

interface Props {
  navigate: (v: View) => void;
  onRequestData: (data: Partial<RequestData>) => void;
  requestData: Partial<RequestData>;
}

export default function CreateRequest({ navigate, onRequestData, requestData }: Props) {
  const { setActiveRequestId, user, selectedProvider, jobFocusLocked, currentJob } = useApp();
  const isBiz = isBusiness(user?.role);
  const [step, setStep] = useState(1);
  const [desc, setDesc] = useState(requestData.description || "");
  const [category, setCategory] = useState(requestData.category || "");
  const [address, setAddress] = useState(requestData.address || user?.address || "");
  const [area, setArea] = useState(requestData.area || user?.area || "");
  const [city, setCity] = useState(requestData.city || user?.city || "");
  const [landmark, setLandmark] = useState("");
  const [timing, setTiming] = useState(requestData.timing || "");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [amount, setAmount] = useState(String(requestData.estimatedAmount || ""));
  const [workersRequired, setWorkersRequired] = useState(1);
  const [needTeam, setNeedTeam] = useState(false);
  const [photos, setPhotos] = useState<string[]>(requestData.photos || []);
  const [voiceNote, setVoiceNote] = useState(requestData.voiceNote || "");
  const [preview, setPreview] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(requestData.lat ?? user?.lat ?? null);
  const [lng, setLng] = useState<number | null>(requestData.lng ?? user?.lng ?? null);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<{ name: string; icon: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [tower, setTower] = useState("");
  const [flat, setFlat] = useState("");
  const [gateNote, setGateNote] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [priceBand, setPriceBand] = useState("");

  React.useEffect(() => {
    void CategoryAPI.list()
      .then((d) => setCategories(d.categories.map((c) => ({ name: c.name, icon: c.icon }))))
      .catch(() => setCategories([]));
  }, []);

  React.useEffect(() => {
    if (!category) return;
    const q = `?category=${encodeURIComponent(category)}&city=${encodeURIComponent(city || user?.city || "")}&pinCode=${encodeURIComponent(pinCode)}`;
    void RequestAPI.priceBand(q)
      .then((d) => {
        setPriceBand(d.text || guidePriceText(category));
        setAmount((current) => current || String(d.typical || typicalPrice(category)));
      })
      .catch(() => {
        setPriceBand(guidePriceText(category));
        setAmount((current) => current || String(typicalPrice(category)));
      });
  }, [category, city, pinCode, user?.city]);

  const scheduledAt =
    timing === "custom" && customDate
      ? new Date(`${customDate}T${customTime || "09:00"}`).toISOString()
      : undefined;
  const scheduledLabel =
    timing === "custom" && customDate
      ? new Date(`${customDate}T${customTime || "09:00"}`).toLocaleString("en-IN")
      : timing === "asap"
        ? "As soon as possible"
        : timing === "today"
          ? "Today"
          : timing === "tomorrow"
            ? "Tomorrow"
            : timing;

  const goNext = async () => {
    if (submitting) return;
    if (step < 6) {
      setStep(step + 1);
      return;
    }
    if (jobFocusLocked) {
      setError("Your current job is active. Open your current job to continue.");
      navigate("active-job");
      return;
    }
    setSubmitting(true);
    setError("");
    const data = {
      description: desc,
      category,
      address,
      area,
      city,
      timing,
      photos,
      voiceNote,
      lat,
      lng,
      landmark,
      estimatedAmount: Number(amount || typicalPrice(category)),
      budgetMin: Number(amount || typicalPrice(category)),
      budgetMax: Number(amount || typicalPrice(category)),
      workersRequired: needTeam ? Math.max(2, workersRequired) : 1,
      scheduledAt,
      scheduledLabel,
      publicPost: true,
      tower,
      flat,
      gateNote,
      pinCode,
      customerLanguage: user?.lang || "en",
      preferredProviderId: selectedProvider?.id || undefined,
    };
    onRequestData(data);
    try {
      const { request } = await RequestAPI.create(data);
      setActiveRequestId(request.id);
      if (needTeam) navigate("find-crew");
      else navigate("finding-solutions");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't create your request");
    } finally {
      setSubmitting(false);
    }
  };
  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate(isBiz ? "business-dashboard" : "customer-home");
  };

  const grabLocation = async () => {
    setLocating(true);
    setError("");
    try {
      const place = await capturePlace();
      setLat(place.lat);
      setLng(place.lng);
      if (place.address) setAddress(place.address);
      if (place.area) setArea(place.area);
      if (place.city) setCity(place.city);
    } catch (e) {
      if (user?.lat != null && user?.lng != null) {
        setLat(user.lat);
        setLng(user.lng);
        if (!address && user.address) setAddress(user.address);
        if (!area && user.area) setArea(user.area);
        if (!city && user.city) setCity(user.city);
        setError("Live GPS was unavailable, so we used your saved location. You can still edit the address.");
      } else {
        setError(e instanceof Error ? e.message : "Could not read GPS. Type the address instead.");
      }
    } finally {
      setLocating(false);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const next = [...photos];
      for (const file of Array.from(files).slice(0, 12 - next.length)) {
        const { url } = await uploadImage(file);
        next.push(url);
      }
      setPhotos(next.slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (jobFocusLocked) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Active request</p>
          <h1 className="font-display text-2xl font-bold text-slate-900">Finish your current job first</h1>
          <p className="text-sm text-slate-600">
            {currentJob ? `${currentJob.category} · ${currentJob.status.replace(/_/g, " ")}` : "You already have an active FixBuddy job."}
          </p>
          <p className="text-sm text-slate-500">Your current job is active. Open your current job to continue.</p>
          <button
            type="button"
            onClick={() => navigate("active-job")}
            className="w-full min-h-12 rounded-xl bg-brand text-white font-semibold"
          >
            Go to Active Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={goBack} className="p-3 rounded-xl hover:bg-brand-soft transition-colors min-w-11 min-h-11">
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div className="flex-1">
              <p className="text-xs text-slate-500">{isBiz ? "Post a Job" : "Create Request"}</p>
              <p className="font-semibold text-slate-900 text-sm">
                {step === 1 && "Service"}
                {step === 2 && "Description"}
                {step === 3 && "Location"}
                {step === 4 && "When"}
                {step === 5 && "Budget"}
                {step === 6 && "Review & Post"}
              </p>
            </div>
          </div>
          <StepIndicator current={step} total={6} />
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-36">
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">What service do you need?</h2>
              <p className="text-slate-500 text-sm">We match available workers from this list.</p>
            </div>
            <div className="space-y-3">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  className={`w-full min-h-16 flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    category === cat.name ? "border-sky-500 bg-sky-50" : "border-sky-100 bg-white hover:border-sky-300"
                  }`}
                >
                  <span className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center flex-shrink-0">
                    <CategoryIcon icon={cat.icon} className="w-6 h-6" />
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{cat.name}</p>
                  </div>
                  {category === cat.name && <CheckCircle className="w-6 h-6 text-sky-600 flex-shrink-0" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory("Other")}
                className={`w-full min-h-16 flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  category === "Other" ? "border-sky-500 bg-sky-50" : "border-sky-100 bg-white hover:border-sky-300"
                }`}
              >
                <span className="w-12 h-12 rounded-2xl bg-sky-50 text-2xl flex items-center justify-center">+</span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Other</p>
                  <p className="text-xs text-slate-500">Describe the service you need</p>
                </div>
                {category === "Other" && <CheckCircle className="w-6 h-6 text-sky-600 flex-shrink-0" />}
              </button>
              {!categories.length && category !== "Other" && (
                <Input label="Category" placeholder="Type a category" value={category} onChange={(e) => setCategory(e.target.value)} />
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">Describe the job</h2>
              <p className="text-slate-500 text-sm">Type it, record a voice note, and add photos of the problem.</p>
            </div>
            <Textarea
              label="Describe your problem"
              placeholder="What is broken? Where is it? Any extra details?"
              rows={5}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Voice note</p>
              <VoiceRecorder url={voiceNote} onChange={setVoiceNote} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Photos ({photos.length}/12)</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                id="job-photos"
                onChange={(e) => void addPhotos(e.target.files)}
              />
              <label
                htmlFor="job-photos"
                className="flex items-center justify-center gap-2 min-h-14 p-4 border-2 border-dashed border-sky-200 rounded-2xl text-sm font-semibold text-slate-600 hover:border-sky-400 hover:text-sky-600 cursor-pointer"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Image className="w-5 h-5" />}
                {uploading ? "Uploading…" : "+ Add Photo"}
              </label>
              <p className="text-xs text-slate-500 mt-2">Photos help workers understand the job before accepting.</p>
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                  {photos.map((src) => (
                    <div key={src} className="relative">
                      <button type="button" onClick={() => setPreview(src)} className="block w-full">
                        <img
                          src={mediaUrl(src)}
                          alt=""
                          className="w-full h-36 sm:h-40 rounded-2xl object-cover border border-slate-200 bg-slate-100"
                          onError={(e) => {
                            e.currentTarget.style.opacity = "0.3";
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotos((p) => p.filter((x) => x !== src))}
                        className="absolute top-2 right-2 w-9 h-9 bg-black/70 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                Your location.
              </h2>
              <p className="text-slate-500 text-sm">We suggest the nearest available workers from this pin.</p>
            </div>
            <button type="button" onClick={() => void grabLocation()} className="w-full min-h-14 flex items-center gap-3 p-4 bg-sky-600 text-white rounded-2xl hover:bg-sky-700 transition-colors">
              {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              <span className="font-semibold">{lat != null ? "Location captured — tap to refresh" : "Use my current location"}</span>
            </button>
            {lat != null && lng != null && (
              <a className="block text-xs text-brand" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                Open GPS pin ({lat.toFixed(4)}, {lng.toFixed(4)})
              </a>
            )}
            <div className="space-y-3">
              <Input label="Address / Flat No." placeholder="House / street" value={address} onChange={(e) => setAddress(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Area" placeholder="Locality" value={area} onChange={(e) => setArea(e.target.value)} />
                <Input label="City" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <Input label="Landmark (Optional)" placeholder="Nearby landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
              <Input label="PIN code" inputMode="numeric" placeholder="641001" value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              <p className="text-xs font-semibold text-slate-500">Apartment / society (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Tower" placeholder="A" value={tower} onChange={(e) => setTower(e.target.value)} />
                <Input label="Flat" placeholder="12B" value={flat} onChange={(e) => setFlat(e.target.value)} />
              </div>
              <Input label="Gate instructions" placeholder="Visitor name, gate code, parking" value={gateNote} onChange={(e) => setGateNote(e.target.value)} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">When do you need this?</h2>
              <p className="text-slate-500 text-sm">ASAP, today, or a scheduled time.</p>
            </div>
            <div className="space-y-3">
              {TIMINGS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTiming(t.id)}
                  className={`w-full min-h-16 flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    timing === t.id ? "border-sky-500 bg-sky-50" : "border-sky-100 bg-white hover:border-sky-300"
                  }`}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <span className="font-semibold text-slate-800">{t.label}</span>
                  {timing === t.id && <CheckCircle className="w-6 h-6 text-sky-600 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
            {timing === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Date" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                <Input label="Time" type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">Budget</h2>
              <p className="text-slate-500 text-sm">Set the amount you want to pay. Workers see this and can reply with a quote.</p>
            </div>
            <Input
              label="Offered amount (₹)"
              type="number"
              min={0}
              placeholder="e.g. 499"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {priceBand && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{priceBand}</p>}
            {selectedProvider && (
              <p className="text-sm text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2">
                Booking {selectedProvider.name} again. OTP, tracking and payment still apply.
              </p>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">Review & Post</h2>
              <p className="text-slate-500 text-sm">Check all details before submitting.</p>
            </div>
            <Card padding="lg" className="space-y-4">
              {[
                { label: "Service", value: category || "—", editStep: 1 },
                { label: "Description", value: desc || "—", editStep: 2 },
                { label: "Location", value: [address, area, city].filter(Boolean).join(", ") || "—", editStep: 3 },
                { label: "When", value: scheduledLabel || "—", editStep: 4 },
                { label: "Budget", value: amount ? `₹${amount}` : "Not set", editStep: 5 },
                { label: "Photos", value: photos.length ? `${photos.length} photo(s)` : "None", editStep: 2 },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 pb-4 border-b border-sky-50 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{row.label}</p>
                    <p className="text-sm text-slate-800 font-medium">{row.value}</p>
                  </div>
                  <button type="button" onClick={() => setStep(row.editStep)} className="p-3 rounded-lg hover:bg-sky-50 text-sky-600 min-w-11 min-h-11">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {voiceNote && <audio controls src={voiceNote} className="w-full" />}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((src) => (
                    <img
                      key={src}
                      src={mediaUrl(src)}
                      alt=""
                      className="h-28 w-full rounded-xl object-cover bg-slate-100"
                      onError={(e) => {
                        e.currentTarget.style.opacity = "0.3";
                      }}
                    />
                  ))}
                </div>
              )}
              <label className="flex items-center justify-between gap-3 pt-2">
                <span className="text-sm font-medium text-slate-800">Need a crew (2+ workers)</span>
                <input type="checkbox" className="accent-brand w-5 h-5" checked={needTeam} onChange={(e) => setNeedTeam(e.target.checked)} />
              </label>
              {needTeam && (
                <Input
                  label="Workers required"
                  type="number"
                  min={2}
                  max={12}
                  value={String(workersRequired)}
                  onChange={(e) => setWorkersRequired(Number(e.target.value || 2))}
                />
              )}
            </Card>
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={mediaUrl(preview)} alt="" className="max-h-[90vh] max-w-full rounded-2xl object-contain" />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={() => void goNext()}
            loading={submitting}
            disabled={
              (step === 1 && !category) ||
              (step === 2 && !desc.trim() && !voiceNote) ||
              (step === 4 && !timing) ||
              (step === 4 && timing === "custom" && !customDate)
            }
          >
            {step === 6 ? (needTeam ? "Find a crew" : "Post Job") : "Continue"}
            {step !== 6 && <ArrowRight className="w-5 h-5" />}
            {step === 6 && <IndianRupee className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
