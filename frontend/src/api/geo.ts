export type GeoPlace = {
  lat: number;
  lng: number;
  address: string;
  area: string;
  city: string;
};

export async function reverseGeocode(lat: number, lng: number): Promise<Omit<GeoPlace, "lat" | "lng">> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { Accept: "application/json" } }
  );
  const geo = await res.json();
  const a = geo.address || {};
  return {
    address: geo.display_name || "",
    area: a.suburb || a.neighbourhood || a.village || a.county || "",
    city: a.city || a.town || a.state_district || a.state || "",
  };
}

export function readGps(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Could not read GPS. Type the address instead.")), {
      enableHighAccuracy: true,
      timeout: 12000,
    });
  });
}

export function mapsNavUrl(
  dest: { lat: number; lng: number },
  origin?: { lat?: number | null; lng?: number | null } | null
) {
  const d = `${dest.lat},${dest.lng}`;
  const hasOrigin = origin?.lat != null && origin?.lng != null;
  return hasOrigin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${d}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${d}&travelmode=driving`;
}

export function openMapsNav(
  dest: { lat: number; lng: number },
  origin?: { lat?: number | null; lng?: number | null } | null
) {
  const url = mapsNavUrl(dest, origin);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

export async function capturePlace(): Promise<GeoPlace> {
  const pos = await readGps();
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  try {
    const place = await reverseGeocode(lat, lng);
    return { lat, lng, ...place };
  } catch {
    return { lat, lng, address: "", area: "", city: "" };
  }
}
