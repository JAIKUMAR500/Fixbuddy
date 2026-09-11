import React from "react";
import { MapPin, Navigation } from "lucide-react";
import { mapsNavUrl } from "../api/geo";

export default function TrackMap({
  customer,
  worker,
  className = "",
  navigateTo,
  origin,
  tapHint,
}: {
  customer?: { lat?: number | null; lng?: number | null } | null;
  worker?: { lat?: number | null; lng?: number | null } | null;
  className?: string;
  navigateTo?: { lat?: number | null; lng?: number | null } | null;
  origin?: { lat?: number | null; lng?: number | null } | null;
  tapHint?: string;
}) {
  const dest =
    navigateTo?.lat != null && navigateTo?.lng != null
      ? { lat: navigateTo.lat, lng: navigateTo.lng }
      : customer?.lat != null && customer?.lng != null
        ? { lat: customer.lat, lng: customer.lng }
        : worker?.lat != null && worker?.lng != null
          ? { lat: worker.lat, lng: worker.lng }
          : null;

  if (!dest) {
    return (
      <div className={`rounded-2xl bg-slate-100 border border-slate-200 px-4 py-8 text-center text-sm text-slate-500 ${className}`}>
        Location will appear when GPS is available.
      </div>
    );
  }

  const href = mapsNavUrl(dest, origin);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-2xl border border-slate-200 bg-white p-4 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Google Maps</p>
      <p className="font-semibold text-slate-900 mt-1">{tapHint || "Open location in Google Maps"}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        {customer?.lat != null && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-sky-600" /> Customer
          </span>
        )}
        {worker?.lat != null && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600" /> Worker
          </span>
        )}
      </div>
      <span className="mt-4 min-h-12 rounded-xl bg-brand text-white font-semibold flex items-center justify-center gap-2">
        <Navigation className="w-4 h-4" /> Open Google Maps
        <MapPin className="w-4 h-4" />
      </span>
    </a>
  );
}
