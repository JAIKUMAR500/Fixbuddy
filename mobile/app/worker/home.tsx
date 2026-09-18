import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, Card, Chip, EmptyState, RetryBanner, Sub, Title } from "../../components/ui";
import AuthGate from "../../components/AuthGate";
import JobCard from "../../components/JobCard";
import RoleArt from "../../components/RoleArt";
import { colors, radius, space } from "../../constants/theme";
import { WorkerAPI } from "../../services/requests";
import { useAuth } from "../../store/AuthContext";
import { greetingName } from "../../utils/role";

type Dash = Awaited<ReturnType<typeof WorkerAPI.dashboard>>;

export default function WorkerHome() {
  const { user, signedIn } = useAuth();
  const router = useRouter();
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    void WorkerAPI.dashboard()
      .then(setDash)
      .catch(() => setError("Unable to load worker dashboard."));
  };
  useFocusEffect(useCallback(() => { if (signedIn) load(); }, [signedIn]));
  if (!signedIn) return <AuthGate role="worker" />;
  const t = dash?.target;

  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} contentContainerStyle={{ gap: 12, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Sub>{dash?.greeting || greetingName(user?.name)}</Sub>
            <Title>Today’s jobs</Title>
          </View>
          <RoleArt role="worker" size={84} />
        </View>
        <RetryBanner error={error} onRetry={load} />
        {t ? (
          <Card>
            <Text style={styles.kicker}>TODAY’S TARGET</Text>
            <Text style={styles.big}>₹{t.amount}</Text>
            <Text style={styles.meta}>Earned ₹{t.earned} · Remaining ₹{t.remaining}</Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.min(100, t.percent || 0)}%` }]} />
            </View>
          </Card>
        ) : null}
        {dash?.activeJob ? (
          <Card onPress={() => router.push("/worker/active-job")}>
            <Chip label="Active job" on />
            <Text style={styles.cardTitle}>{dash.activeJob.category}</Text>
            <Text style={styles.meta}>{dash.activeJob.status.replace(/_/g, " ")}</Text>
          </Card>
        ) : null}
        <Text style={styles.section}>Nearby</Text>
        {(dash?.recommended || []).map((j) => (
          <JobCard
            key={j.id}
            job={{
              id: j.id,
              status: j.status || "open",
              category: j.category,
              estimatedAmount: j.amount,
              area: j.area,
              distanceKm: j.distanceKm,
            }}
            onPress={() => router.push({ pathname: "/worker/job-details", params: { id: j.id } })}
          />
        ))}
        {!dash?.recommended?.length && !dash?.activeJob ? (
          <EmptyState title="No nearby jobs right now." body="Pull to refresh, or open Nearby to scan open jobs." action="Find jobs" onAction={() => router.push("/worker/nearby-jobs")} />
        ) : null}
        <Button title="Find next job" onPress={() => router.push("/worker/nearby-jobs")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.lg },
  kicker: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  big: { fontSize: 32, fontWeight: "900", color: colors.navy },
  meta: { color: colors.muted, marginTop: 4 },
  bar: { height: 10, backgroundColor: colors.brandSoft, borderRadius: radius.full, marginTop: 10, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.brand },
  section: { fontWeight: "800", color: colors.navy },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.navy, marginTop: 6 },
});
