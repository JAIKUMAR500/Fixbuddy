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
