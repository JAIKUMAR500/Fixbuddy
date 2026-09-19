import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, Card, Chip, ErrorText, Field, Sub, Title } from "./ui";
import AuthGate from "./AuthGate";
import RoleArt from "./RoleArt";
import VoicePlayer from "./VoicePlayer";
import { colors, radius, space } from "../constants/theme";
import { RequestAPI } from "../services/requests";
import { ApiError } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { TIMELINE, isEngagedStatus, isPaidStatus, isTrackingStatus, statusLabel } from "../utils/jobStatus";
import { publicRole } from "../utils/role";
import LiveTrackMap from "./LiveTrackMap";
import { useWorkerGps } from "../hooks/useWorkerGps";
import { formatRupees, jobAmountRupees } from "../utils/money";

export default function ActiveJobView() {
  const { user, signedIn, currentJob, refreshJob } = useAuth();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const role = publicRole(user?.role);
  const job = currentJob;
  const id = job?.id;
  useWorkerGps(id, job?.status, role === "worker");

  useEffect(() => {
    if (!signedIn) return;
    const t = setInterval(() => void refreshJob(), 5000);
    return () => clearInterval(t);
  }, [refreshJob, signedIn]);

  if (!signedIn) return <AuthGate role={role === "admin" ? "customer" : role} />;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setError("");
    setBusy(label);
    try {
      await fn();
      await refreshJob();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  if (!job || !isEngagedStatus(job.status)) {
    return (
      <SafeAreaView style={styles.wrap}>
        <RoleArt kind="ai" size={120} />
        <Title>No active job</Title>
        <Sub>When a worker accepts, this screen becomes the live job. Matching jobs stay in My Jobs until then.</Sub>
        <Button
          title={role === "worker" ? "Find nearby jobs" : "Post a job"}
          onPress={() => router.push(role === "worker" ? "/worker/nearby-jobs" : role === "business" ? "/business/create-job" : "/customer/create-job")}
        />
      </SafeAreaView>
    );
  }

  const stepIndex = Math.max(
    0,
    TIMELINE.findIndex((s) => s.status === job.status || (job.status === "scheduled" && s.status === "accepted")),
  );
  const amount = jobAmountRupees(job);
  const otherName = role === "worker" ? job.customer?.name : job.provider?.name || job.provider?.businessName;

  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
        <Text style={styles.kicker}>ACTIVE JOB</Text>
        <Chip label={statusLabel(job.status)} on />
        <Title>{job.category || "Active job"}</Title>
        <Text style={styles.price}>{formatRupees(amount)}</Text>
        <Sub>{job.description || job.area || job.city}</Sub>
        {job.voiceNote ? <VoicePlayer url={job.voiceNote} /> : null}
        {isTrackingStatus(job.status) ? (
          <LiveTrackMap
            customer={{ lat: job.lat, lng: job.lng }}
            worker={role === "worker" ? null : { lat: job.workerLat, lng: job.workerLng }}
            workerRole={role === "worker"}
          />
        ) : (
          <View style={styles.map}>
            <Text style={styles.mapText}>{otherName || "Job location"}</Text>
            <Text style={styles.mapSub}>
              {job.area || job.city || job.address || "Location on the job"}
              {job.etaMinutes ? ` · ETA ${job.etaMinutes} min` : ""}
              {job.distanceKm != null ? ` · ${Number(job.distanceKm).toFixed(1)} km` : ""}
            </Text>
          </View>
        )}
        {otherName ? (
          <Card>
            <Text style={styles.strong}>{role === "worker" ? "Customer" : "Worker"}</Text>
            <Text style={styles.meta}>{otherName}{job.provider?.rating ? ` · ${job.provider.rating}` : ""}</Text>
          </Card>
        ) : null}
        <Card>
          {TIMELINE.map((item, i) => (
            <View key={item.status} style={styles.row}>
              <View style={[styles.dot, i <= stepIndex && styles.dotOn]} />
              <Text style={[styles.rowText, i <= stepIndex && styles.rowOn]}>{item.label}</Text>
            </View>
          ))}
        </Card>
        {role === "customer" && job.status === "arrived" ? (
          <Card>
            <Text style={styles.strong}>Your worker has arrived.</Text>
            {job.jobOtp ? (
              <>
                <Text style={styles.meta}>Share this OTP with the worker.</Text>
                <Text style={styles.otp}>{job.jobOtp}</Text>
              </>
            ) : (
              <Text style={styles.meta}>Ask the worker to wait — the OTP appears when they mark arrived.</Text>
            )}
          </Card>
        ) : null}
        {role === "worker" && job.status === "arrived" ? (
          <>
            <Field label="Ask the customer for the OTP" keyboardType="number-pad" maxLength={4} value={otp} onChangeText={setOtp} />
            <Button title="Verify OTP" loading={busy === "otp"} onPress={() => id && void run("otp", () => RequestAPI.verifyOtp(id, otp))} />
          </>
        ) : null}
        <ErrorText>{error}</ErrorText>
        {role === "worker" && (job.status === "accepted" || job.status === "scheduled") ? (
          <Button title="Start travel" loading={busy === "go"} onPress={() => id && void run("go", () => RequestAPI.enroute(id))} />
        ) : null}
        {role === "worker" && job.status === "on_the_way" ? (
          <Button title="I have arrived" loading={busy === "arr"} onPress={() => id && void run("arr", () => RequestAPI.arrive(id))} />
        ) : null}
        {role === "worker" && job.status === "otp_verified" ? (
          <Button title="Start work" loading={busy === "start"} onPress={() => id && void run("start", () => RequestAPI.start(id))} />
        ) : null}
        {role === "worker" && job.status === "in_progress" ? (
          <Button title="Complete job" loading={busy === "done"} onPress={() => id && void run("done", () => RequestAPI.complete(id))} />
        ) : null}
        {role !== "customer" && job.status === "completed" ? (
          <Button title="Confirm payment (simulated cash / UPI)" loading={busy === "pay"} onPress={() => id && void run("pay", () => RequestAPI.collect(id))} />
        ) : null}
        {role === "customer" && isPaidStatus(job.status) ? (
          <Button title="Leave a review" onPress={() => router.push("/customer/review")} />
        ) : null}
        {job.customer?.phone || job.provider?.phone ? (
          <Button
            title="Call"
            variant="ghost"
            onPress={() => void Linking.openURL(`tel:${role === "worker" ? job.customer?.phone : job.provider?.phone}`)}
          />
        ) : null}
        {isPaidStatus(job.status) ? <Sub>This job is closed. It will show in history.</Sub> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.lg },
  kicker: { color: colors.brand, fontWeight: "800", letterSpacing: 1.2, fontSize: 12 },
  price: { fontSize: 32, fontWeight: "900", color: colors.navy },
  map: { height: 180, borderRadius: radius.lg, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", gap: 4, padding: 16 },
  mapText: { color: colors.white, fontWeight: "800", fontSize: 18, textAlign: "center" },
  mapSub: { color: "#93C5FD", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.success },
  rowText: { color: colors.muted, fontWeight: "600" },
  rowOn: { color: colors.navy, fontWeight: "800" },
  strong: { fontWeight: "800", color: colors.navy },
  meta: { color: colors.muted, marginTop: 4 },
  otp: { fontSize: 40, fontWeight: "900", letterSpacing: 12, color: colors.navy, marginTop: 8 },
});
