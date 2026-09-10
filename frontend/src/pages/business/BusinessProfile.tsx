import React, { useRef, useState } from "react";
import { Camera, Edit2, MapPin, Clock, Phone, Mail, CheckCircle, Eye, Loader2, LogOut } from "lucide-react";
import { View } from "../../types";
import { Button, Card, VerifiedBadge, RatingStars } from "../../components/ui";
import { useApp } from "../../api/AppContext";
import { AuthAPI, ProviderAPI, uploadImage, mediaUrl, type Provider } from "../../api/client";
import ImageUpload from "../../components/ImageUpload";
import { serviceLabel } from "../../api/display";

export default function BusinessProfile({ navigate }: { navigate: (v: View) => void }) {
  const { user, setUser, setSelectedProvider, logout } = useApp();
  const p = user?.provider;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [description, setDescription] = useState(p?.description || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [location, setLocation] = useState(p?.location || [user?.area, user?.city].filter(Boolean).join(", "));
  const [photos, setPhotos] = useState<string[]>(p?.photos || []);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const cover = p?.coverPhoto || photos[0] || "";
  const logo = user?.avatar || "";
  const [hoursFrom, setHoursFrom] = useState(p?.hours?.from || "08:00");
  const [hoursTo, setHoursTo] = useState(p?.hours?.to || "20:00");
  const [website, setWebsite] = useState(p?.website || "");

  const uploadField = async (file: File | undefined, kind: "avatar" | "coverPhoto") => {
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const { url } = await uploadImage(file);
      const { user: next } = await ProviderAPI.update({ [kind]: url, ...(kind === "coverPhoto" ? { coverPhoto: url } : { avatar: url }) });
      setUser(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { user: next } = await ProviderAPI.update({
        description,
        location,
        photos,
        coverPhoto: p?.coverPhoto || photos[0] || "",
        hours: { from: hoursFrom, to: hoursTo },
        website,
        phone,
      });
      if (phone !== user?.phone) {
        const patched = await AuthAPI.updateMe({ phone });
        setUser(patched.user);
      } else {
        setUser(next);
      }
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>Business Profile</h1>
          <p className="text-slate-500 text-sm">Manage your public profile</p>
        </div>
        <button
          className="flex items-center gap-1.5 text-sm text-sky-600 font-medium bg-sky-50 px-3 py-2 rounded-xl border border-sky-200"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : <><Edit2 className="w-4 h-4" /> Edit</>}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="relative rounded-3xl overflow-hidden h-48 sm:h-64 md:h-72 bg-sky-100 shadow-sm">
        {cover ? (
          <img src={mediaUrl(cover)} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base text-sky-700">Add a cover photo</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadField(e.target.files?.[0], "coverPhoto")} />
        <button type="button" onClick={() => coverRef.current?.click()} className="absolute top-4 right-4 bg-white/95 backdrop-blur p-3 rounded-xl shadow-md min-w-11 min-h-11">
          {saving ? <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> : <Camera className="w-5 h-5 text-slate-700" />}
        </button>
      </div>

      <Card padding="lg" className="-mt-12 relative z-10">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="relative -mt-16 sm:-mt-20">
            {logo ? (
              <img src={mediaUrl(logo)} alt="logo" className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-white shadow-xl bg-white" />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-white shadow-xl bg-sky-100 text-sky-700 font-bold text-3xl flex items-center justify-center">
                {(p?.businessName || user?.name || "B").slice(0, 1)}
              </div>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadField(e.target.files?.[0], "avatar")} />
            <button type="button" onClick={() => logoRef.current?.click()} className="absolute -bottom-1 -right-1 w-9 h-9 bg-sky-600 text-white rounded-full flex items-center justify-center shadow-md">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-w-0 mt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900">{p?.businessName || user?.name || "Your business"}</h2>
              {p?.verified && <VerifiedBadge />}
            </div>
            <p className="text-sm text-slate-500">{p?.category || "Complete onboarding to set a category"}</p>
            <RatingStars value={p?.ratingAvg || 0} count={p?.ratingCount || 0} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-sky-50">
          {[
            { label: "Jobs Done", value: String(p?.completedJobs || 0) },
            { label: "Experience", value: p?.experience || "—" },
            { label: "Response", value: p?.responseTime || "—" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-bold text-sky-700 text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">About</h3>
        {editing ? (
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full text-sm text-slate-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        ) : (
          <p className="text-sm text-slate-700">{p?.description || "Add a short description so customers know what you do."}</p>
        )}
      </Card>

      <Card padding="md">
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">Services Offered</h3>
        <div className="flex flex-wrap gap-2">
          {(p?.services || []).map((s, i) => (
            <span key={`${serviceLabel(s)}-${i}`} className="flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 text-xs rounded-full border border-sky-200">
              <CheckCircle className="w-3 h-3" /> {serviceLabel(s)}
            </span>
          ))}
          {!(p?.services || []).length && <p className="text-sm text-slate-500">No services listed yet.</p>}
        </div>
      </Card>

      <Card padding="lg">
        <h3 className="font-display font-bold text-slate-900 mb-4 text-lg">Contact & Location</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-sky-600" /> Service area</p>
            {editing ? (
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full text-base bg-white border border-sky-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            ) : (
              <p className="text-base font-medium text-slate-800">{location || "Add your service area"}</p>
            )}
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-2"><Phone className="w-4 h-4 text-sky-600" /> Phone</p>
            {editing ? (
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full text-base bg-white border border-sky-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            ) : (
              <p className="text-base font-medium text-slate-800">{phone || "Add a phone number"}</p>
            )}
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-2"><Mail className="w-4 h-4 text-sky-600" /> Email</p>
            <p className="text-base font-medium text-slate-800 break-all">{user?.email}</p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-sky-600" /> Hours</p>
            {editing ? (
              <div className="flex items-center gap-2">
                <input type="time" value={hoursFrom} onChange={(e) => setHoursFrom(e.target.value)} className="flex-1 text-base bg-white border border-sky-200 rounded-xl px-3 py-2.5" />
                <span className="text-slate-400">–</span>
                <input type="time" value={hoursTo} onChange={(e) => setHoursTo(e.target.value)} className="flex-1 text-base bg-white border border-sky-200 rounded-xl px-3 py-2.5" />
              </div>
            ) : (
              <p className="text-base font-medium text-slate-800">Mon–Sat, {hoursFrom} – {hoursTo}</p>
            )}
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Website</p>
            {editing ? (
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="w-full text-base bg-white border border-sky-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            ) : (
              <p className="text-base font-medium text-slate-800">{website || "Not added"}</p>
            )}
          </div>
        </div>
      </Card>

      {editing && (
        <ImageUpload
          variant="gallery"
          label="Work photos"
          hint="Customers see these on your public profile"
          multiple
          urls={photos}
          onChange={setPhotos}
          max={8}
        />
      )}

      {!editing && photos.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-slate-900 mb-3 text-lg">Work photos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((url) => (
              <img key={url} src={mediaUrl(url)} alt="" className="h-36 sm:h-44 w-full rounded-2xl object-cover bg-slate-100" onError={(e) => { e.currentTarget.style.opacity = "0.25"; }} />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <Button variant="primary" fullWidth size="lg" loading={saving} onClick={() => void save()}>
          Save Profile
        </Button>
      )}

      <button
        onClick={() => {
          const preview: Provider = {
            id: user?.id || "",
            name: p?.businessName || user?.name || "",
            avatar: user?.avatar || "",
            rating: p?.ratingAvg || 0,
            reviews: p?.ratingCount || 0,
            completedJobs: p?.completedJobs || 0,
            distance: "you",
            responseTime: p?.responseTime || "",
            category: p?.category || "",
            price: `₹${p?.startingPrice || 0} onwards`,
            available: p?.available !== false,
            verified: !!p?.verified,
            description: p?.description || "",
            experience: p?.experience || "",
            location: p?.location || location,
            phone: user?.phone || "",
            services: p?.services || [],
            photos: p?.photos || photos,
            coverPhoto: p?.coverPhoto || cover,
            hours: p?.hours,
            serviceAreas: p?.serviceAreas,
            website: p?.website,
          };
          setSelectedProvider(preview);
          navigate("provider-details");
        }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-sky-200 text-sky-600 font-medium text-sm hover:bg-sky-50 transition-colors"
      >
        <Eye className="w-4 h-4" /> Preview as Customer
      </button>

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
