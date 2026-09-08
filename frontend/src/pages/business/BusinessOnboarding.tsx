import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, MapPin } from "lucide-react";
import { View } from "../../types";
import { Button, Input, Textarea, StepIndicator, Card } from "../../components/ui";
import { CategoryAPI, ProviderAPI, type ServiceCategory } from "../../api/client";
import { useApp } from "../../api/AppContext";
import { capturePlace } from "../../api/geo";
import ImageUpload from "../../components/ImageUpload";

export default function BusinessOnboarding({ navigate }: { navigate: (v: View) => void }) {
  const { setUser, user } = useApp();
  const p = user?.provider;
  const [step, setStep] = useState(1);
  const [bizName, setBizName] = useState(p?.businessName || user?.name || "");
  const [category, setCategory] = useState(p?.category || "");
  const [selectedServices, setSelectedServices] = useState<string[]>(p?.services || []);
  const [city, setCity] = useState(user?.city || "");
  const [areas, setAreas] = useState((p?.serviceAreas || []).join(", ") || user?.area || "");
  const [hours, setHours] = useState(p?.hours || { from: "08:00", to: "20:00" });
  const [description, setDescription] = useState(p?.description || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [website, setWebsite] = useState(p?.website || "");
  const [logo, setLogo] = useState<string[]>(user?.avatar ? [user.avatar] : []);
  const [cover, setCover] = useState<string[]>(p?.coverPhoto ? [p.coverPhoto] : []);
  const [photos, setPhotos] = useState<string[]>(p?.photos || []);
  const [lat, setLat] = useState<number | null>(user?.lat ?? p?.lat ?? null);
  const [lng, setLng] = useState<number | null>(user?.lng ?? p?.lng ?? null);
  const [locating, setLocating] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const TOTAL = 8;
  const isWorker = user?.role === "worker";
  const categoryNames = categories.map((c) => c.name);
  const selectedCat = categories.find((c) => c.name === category);
  const serviceOptions = (selectedCat?.services || [])
    .filter((s) => s.active !== false)
    .map((s) => s.name)
    .filter(Boolean);

  useEffect(() => {
    void CategoryAPI.list()
      .then((d) => setCategories(d.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const grabLocation = async () => {
    setLocating(true);
    setError("");
    try {
      const place = await capturePlace();
      setLat(place.lat);
      setLng(place.lng);
      if (place.city) setCity(place.city);
      if (place.area && !areas) setAreas(place.area);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read GPS");
    } finally {
      setLocating(false);
    }
  };

  const goNext = async () => {
    if (step < TOTAL) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    setError("");
    const serviceAreas = areas.split(",").map((a) => a.trim()).filter(Boolean);
    try {
      const { user: next } = await ProviderAPI.onboard({
        businessName: bizName,
        category,
        services: selectedServices,
        serviceAreas,
        hours,
        location: [serviceAreas[0], city].filter(Boolean).join(", "),
        city,
        area: serviceAreas[0] || user?.area || "",
        phone,
        description,
        website,
        avatar: logo[0] || "",
        coverPhoto: cover[0] || photos[0] || "",
        photos,
        lat,
        lng,
      });
      setUser(next);
      navigate("business-dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleService = (s: string) => {
    setSelectedServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col">
      <header className="bg-white border-b border-sky-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => (step > 1 ? setStep(step - 1) : navigate("business-landing"))} className="p-2 rounded-xl hover:bg-sky-50">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex-1">
              <p className="text-xs text-slate-500">{isWorker ? "Worker Setup" : "Business Setup"} · Step {step}/{TOTAL}</p>
              <p className="font-semibold text-slate-900 text-sm">
                {step === 1 && "Business Name"}
                {step === 2 && "Business Category"}
                {step === 3 && "Services Offered"}
                {step === 4 && "Service Areas"}
                {step === 5 && "Working Hours"}
                {step === 6 && "Business Information"}
                {step === 7 && "Profile & Photos"}
                {step === 8 && "Review Profile"}
              </p>
            </div>
          </div>
          <StepIndicator current={step} total={TOTAL} />
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>What's your business name?</h2>
              <p className="text-slate-500 text-sm">This is how customers will find you on Fixbuddy.</p>
            </div>
            <Input label="Business Name" placeholder="Your registered or trade name" value={bizName} onChange={(e) => setBizName(e.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>What does your business do?</h2>
              <p className="text-slate-500 text-sm">Choose the category that best describes your services.</p>
            </div>
            {categoryNames.length === 0 ? (
              <Input label="Category" placeholder="Type your category" value={category} onChange={(e) => setCategory(e.target.value)} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {categoryNames.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`p-4 rounded-2xl border-2 text-left text-sm font-semibold transition-all ${category === c ? "border-sky-500 bg-sky-50 text-sky-700" : "border-sky-100 bg-white text-slate-700 hover:border-sky-300"}`}
                  >
                    {category === c && <CheckCircle className="w-4 h-4 text-sky-600 mb-1" />}
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>What services do you offer?</h2>
              <p className="text-slate-500 text-sm">Select from this category, or type your own.</p>
            </div>
            {serviceOptions.length > 0 && (
              <div className="space-y-2">
                {serviceOptions.map((s) => (
                  <button key={s} onClick={() => toggleService(s)} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${selectedServices.includes(s) ? "border-sky-500 bg-sky-50" : "border-sky-100 bg-white hover:border-sky-300"}`}>
                    <span className="text-sm font-medium text-slate-800">{s}</span>
                    {selectedServices.includes(s) && <CheckCircle className="w-5 h-5 text-sky-600" />}
                  </button>
                ))}
              </div>
            )}
            <Input
              label="Add a service"
              placeholder="Type a service and press Enter"
              onKeyDown={(e) => {
                const value = e.currentTarget.value.trim();
                if (e.key === "Enter" && value) {
                  e.preventDefault();
                  if (!selectedServices.includes(value)) setSelectedServices((prev) => [...prev, value]);
                  e.currentTarget.value = "";
                }
              }}
            />
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedServices.map((s) => (
                  <button key={s} onClick={() => toggleService(s)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                    {s} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Where do you operate?</h2>
              <p className="text-slate-500 text-sm">Share GPS so customers nearby can find you, then add the areas you serve.</p>
            </div>
            <button type="button" onClick={() => void grabLocation()} className="w-full flex items-center gap-3 p-4 bg-sky-600 text-white rounded-2xl hover:bg-sky-700 transition-colors">
              {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              <span className="font-semibold text-sm">{lat != null ? "Location captured — tap to refresh" : "Use my current location"}</span>
            </button>
            {lat != null && lng != null && (
              <a className="block text-xs text-brand" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                Open GPS pin ({lat.toFixed(4)}, {lng.toFixed(4)})
              </a>
            )}
            <Input label="City" placeholder="Your city" value={city} onChange={(e) => setCity(e.target.value)} />
            <Textarea label="Areas / Localities" placeholder="Comma-separated areas you serve" rows={3} value={areas} onChange={(e) => setAreas(e.target.value)} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Your working hours.</h2>
              <p className="text-slate-500 text-sm">When are you available to take jobs?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Opens at" type="time" value={hours.from} onChange={(e) => setHours({ ...hours, from: e.target.value })} />
              <Input label="Closes at" type="time" value={hours.to} onChange={(e) => setHours({ ...hours, to: e.target.value })} />
            </div>
            <div className="space-y-2">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, i) => (
                <div key={day} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${i < 6 ? "border-sky-200 bg-sky-50" : "border-slate-100 bg-white"}`}>
                  <span className="text-sm font-medium text-slate-800">{day}</span>
                  <span className={`text-xs font-semibold ${i < 6 ? "text-emerald-600" : "text-slate-400"}`}>{i < 6 ? `${hours.from} – ${hours.to}` : "Closed"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Tell customers about your business.</h2>
            </div>
            <Textarea label="Business Description" placeholder="Years of experience, certifications, what you specialise in." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input label="Phone Number" type="tel" placeholder="Contact number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Email" type="email" value={user?.email || ""} readOnly />
            <Input label="Website (Optional)" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        )}

        {step === 7 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Add photos & logo.</h2>
              <p className="text-slate-500 text-sm">Businesses with photos get 3x more requests.</p>
            </div>
            <ImageUpload
              variant="logo"
              label="Business logo"
              hint="Square logo. PNG or JPG, up to 5MB."
              urls={logo}
              onChange={setLogo}
              max={1}
            />
            <ImageUpload
              variant="cover"
              label="Cover photo"
              hint="Wide banner for your public profile."
              urls={cover}
              onChange={setCover}
              max={1}
            />
            <ImageUpload
              variant="gallery"
              label="Work photos"
              hint="Show finished jobs so customers trust your work."
              multiple
              urls={photos}
              onChange={setPhotos}
              max={8}
            />
          </div>
        )}

        {step === 8 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Review your profile.</h2>
              <p className="text-slate-500 text-sm">Everything looks good? Let's go!</p>
            </div>
            <Card padding="lg" className="space-y-4 overflow-hidden">
              {cover[0] && <img src={cover[0]} alt="" className="w-full h-36 object-cover rounded-2xl -mt-1" />}
              <div className="flex items-center gap-3">
                {logo[0] ? (
                  <img src={logo[0]} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow" />
                ) : null}
                <div>
                  <p className="font-bold text-slate-900">{bizName || "—"}</p>
                  <p className="text-sm text-slate-500">{category || "No category"}</p>
                </div>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 6).map((url) => (
                    <img key={url} src={url} alt="" className="h-20 w-full rounded-xl object-cover" />
                  ))}
                </div>
              )}
              {[
                { label: "Services", value: selectedServices.length ? selectedServices.join(", ") : "—" },
                { label: "City", value: city || "—" },
                { label: "Service Areas", value: areas || "—" },
                { label: "GPS", value: lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Not captured" },
                { label: "Working Hours", value: `${hours.from} – ${hours.to}, Mon–Sat` },
              ].map((row) => (
                <div key={row.label} className="pb-3 border-b border-sky-50 last:border-0">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{row.label}</p>
                  <p className="text-sm font-medium text-slate-800">{row.value}</p>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white border-t border-sky-100 p-4">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={() => void goNext()}
            loading={saving}
            disabled={(step === 1 && !bizName.trim()) || (step === 2 && !category)}
          >
            {step === TOTAL ? (isWorker ? "Create Worker Profile" : "Create Business Profile") : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
