import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, Chip, ErrorText, Field, Sub, Title } from "./ui";
import AuthGate from "./AuthGate";
import VoiceRecorder from "./VoiceRecorder";
import VoicePlayer from "./VoicePlayer";
import { colors, radius, space } from "../constants/theme";
import { FALLBACK_CATEGORIES, TIMINGS, categoryEmoji } from "../constants/categories";
import { typicalPrice, guidePriceText, formatRupees } from "../utils/money";
import { CategoryAPI, RequestAPI, UploadAPI } from "../services/requests";
import { ApiError } from "../services/api";
import { mediaUrl } from "../services/media";
import { useAuth } from "../store/AuthContext";
import { publicRole } from "../utils/role";

const STEPS = ["Service", "Details", "Location", "Budget & time", "Review"];

export default function CreateJobFlow({
  activeHref,
  matchingHref,
}: {
  activeHref: string;
  matchingHref: string;
}) {
  const { user, signedIn, jobLocked, currentJob } = useAuth();
  const router = useRouter();
  const posting = useRef(false);
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState<{ name: string; icon?: string }[]>(FALLBACK_CATEGORIES);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [voiceNote, setVoiceNote] = useState("");
  const [address, setAddress] = useState(user?.address || "");
  const [area, setArea] = useState(user?.area || "");
  const [city, setCity] = useState(user?.city || "");
  const [pinCode, setPinCode] = useState("");
  const [lat, setLat] = useState<number | null>(user?.lat ?? null);
  const [lng, setLng] = useState<number | null>(user?.lng ?? null);
  const [amount, setAmount] = useState("");
  const [timing, setTiming] = useState("asap");
  const [band, setBand] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const role = publicRole(user?.role);

  useEffect(() => {
    void CategoryAPI.list()
      .then((d) => {
        const rows = d.categories || [];
        setCats(rows.length ? [...rows, { name: "Other", icon: "sparkles" }] : FALLBACK_CATEGORIES);
      })
      .catch(() => setCats(FALLBACK_CATEGORIES));
  }, []);

  useEffect(() => {
    if (!category || !signedIn) return;
    const q = `?category=${encodeURIComponent(category)}&city=${encodeURIComponent(city)}`;
    void RequestAPI.priceBand(q)
      .then((d) => {
        setBand(d.text || guidePriceText(category));
        setAmount((current) => current || String(d.typical || typicalPrice(category)));
      })
      .catch(() => {
        setBand(guidePriceText(category));
        setAmount((current) => current || String(typicalPrice(category)));
      });
  }, [category, city, signedIn]);

  if (!signedIn) return <AuthGate role={role === "admin" ? "customer" : role} />;

  if (jobLocked && currentJob) {
    return (
      <SafeAreaView style={styles.wrap}>
        <Title>Finish your current job first</Title>
        <Sub>{currentJob.category} is still active. The server will not let you post another until this one is paid or cancelled.</Sub>
        <Button title="Open current job" onPress={() => router.replace(activeHref)} />
      </SafeAreaView>
    );
  }

  const scheduledLabel = TIMINGS.find((t) => t.id === timing)?.hint || timing;

  const canContinue =
    (step === 1 && !!category) ||
    (step === 2 && (!!description.trim() || !!voiceNote)) ||
    step === 3 ||
    (step === 4 && !!timing) ||
    step === 5;

  const grabLocation = async () => {
    setLocating(true);
    setError("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Location permission denied. Type the address instead.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      const places = await Location.reverseGeocodeAsync(pos.coords);
      const place = places[0];
      if (place) {
        setAddress([place.name, place.street].filter(Boolean).join(", ") || address);
        setArea(place.district || place.subregion || area);
        setCity(place.city || place.region || city);
        if (place.postalCode) setPinCode(place.postalCode.replace(/\D/g, "").slice(0, 6));
      }
    } catch {
      setError("Could not read GPS. Type the address instead.");
    } finally {
      setLocating(false);
    }
  };

  const addPhoto = async () => {
    setUploading(true);
    setError("");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Photo permission denied.");
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
        allowsMultipleSelection: false,
      });
      if (picked.canceled || !picked.assets[0]?.base64) return;
      const dataUrl = `data:image/jpeg;base64,${picked.assets[0].base64}`;
      const { url } = await UploadAPI.dataUrl(dataUrl, "job.jpg");
      setPhotos((p) => [...p, url].slice(0, 12));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const post = async () => {
    if (posting.current) return;
    setError("");
    if (!category || (!description.trim() && !voiceNote)) {
      setError("Add a description or a voice note, and pick a category.");
      return;
    }
    posting.current = true;
    setBusy(true);
    try {
      const { request } = await RequestAPI.create({
        category,
        description: description.trim() || "Voice note",
        voiceNote,
        address,
        area,
        city,
        pinCode,
        lat,
        lng,
        photos,
        timing,
        scheduledLabel,
        estimatedAmount: Number(amount || typicalPrice(category)),
        budgetMin: Number(amount || typicalPrice(category)),
        budgetMax: Number(amount || typicalPrice(category)),
        publicPost: true,
      });
      router.replace(`${matchingHref}?id=${encodeURIComponent(request.id)}`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Could not post job";
      setError(message);
      if (e instanceof ApiError && e.status === 409) router.replace(activeHref);
      if (e instanceof ApiError && e.status === 401) router.replace("/login");
    } finally {
      posting.current = false;
      setBusy(false);
    }
  };

  const next = () => {
    if (step < 5) setStep(step + 1);
    else void post();
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{role === "business" ? "Post a Job" : "Create request"}</Text>
          <Title>{STEPS[step - 1]}</Title>
          <View style={styles.bar}>
            {STEPS.map((_, i) => (
              <View key={STEPS[i]} style={[styles.seg, i < step && styles.segOn]} />
            ))}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {error ? <ErrorText>{error}</ErrorText> : null}
          {step === 1 ? (
            <>
              <Sub>Pick the service. We match nearby workers from this list.</Sub>
              {cats.map((c) => (
                <Pressable key={c.name} onPress={() => setCategory(c.name)} style={[styles.row, category === c.name && styles.rowOn]}>
                  <Text style={styles.emoji}>{categoryEmoji(c.icon, c.name)}</Text>
                  <Text style={[styles.rowText, category === c.name && { color: colors.brand }]}>{c.name}</Text>
                  {category === c.name ? <Chip label="Selected" on /> : null}
                </Pressable>
              ))}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <VoiceRecorder url={voiceNote} onChange={setVoiceNote} />
              <Field
                label="Or type what needs to be done"
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="What is broken? Where is it?"
                style={{ minHeight: 120, textAlignVertical: "top" }}
              />
              <Button title={uploading ? "Uploading…" : "Add photo (optional)"} variant="ghost" loading={uploading} onPress={() => void addPhoto()} />
              {photos.length ? (
                <View style={styles.photos}>
                  {photos.map((src) => (
                    <Image key={src} source={{ uri: mediaUrl(src) }} style={styles.thumb} />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Button title={lat != null ? "Location captured — tap to refresh" : "Use my current location"} loading={locating} onPress={() => void grabLocation()} />
              {lat != null && lng != null ? <Sub>GPS pin {lat.toFixed(4)}, {lng.toFixed(4)}</Sub> : null}
              <Field label="Address / flat" value={address} onChangeText={setAddress} placeholder="House / street" />
              <Field label="Area" value={area} onChangeText={setArea} placeholder="Locality" />
              <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
              <Field label="PIN code" keyboardType="number-pad" value={pinCode} onChangeText={(v) => setPinCode(v.replace(/\D/g, "").slice(0, 6))} />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <Field label="Budget (₹)" keyboardType="number-pad" value={amount} onChangeText={setAmount} placeholder="800" />
              {band ? <Text style={styles.band}>{band}</Text> : null}
              {TIMINGS.map((t) => (
                <Pressable key={t.id} onPress={() => setTiming(t.id)} style={[styles.row, timing === t.id && styles.rowOn]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText}>{t.label}</Text>
                    <Text style={styles.hint}>{t.hint}</Text>
                  </View>
                  {timing === t.id ? <Chip label="Selected" on /> : null}
                </Pressable>
              ))}
            </>
          ) : null}
          {step === 5 ? (
            <Card>
              {[
                ["Service", category],
                ["Description", description],
                ["Location", [address, area, city].filter(Boolean).join(", ") || "—"],
                ["Time", scheduledLabel],
                ["Budget", formatRupees(Number(amount || typicalPrice(category)))],
                ["Voice note", voiceNote ? "Attached" : "None"],
              ].map(([label, value]) => (
                <View key={label} style={styles.review}>
                  <Text style={styles.meta}>{label}</Text>
                  <Text style={styles.strong}>{value}</Text>
                </View>
              ))}
              {voiceNote ? <VoicePlayer url={voiceNote} /> : null}
            </Card>
          ) : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: 18 }]}>
          {step > 1 ? <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
          <View style={{ flex: 1 }}>
            <Button
              title={step === 5 ? "Post job" : "Continue"}
              disabled={!canContinue}
              loading={busy}
              onPress={next}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: space.lg },
  header: { paddingTop: 8, paddingBottom: 12, gap: 6 },
  kicker: { color: colors.brand, fontWeight: "800", fontSize: 12, textTransform: "uppercase" },
  bar: { flexDirection: "row", gap: 6, marginTop: 8 },
  seg: { flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.border },
  segOn: { backgroundColor: colors.brand },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, padding: 14, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border },
  rowOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  rowText: { flex: 1, fontWeight: "800", color: colors.navy, fontSize: 16 },
  emoji: { fontSize: 26 },
  hint: { color: colors.muted, marginTop: 2 },
  band: { color: colors.brand, fontWeight: "600" },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.border },
  review: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  meta: { fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase" },
  strong: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 2 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 8, padding: space.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
});
