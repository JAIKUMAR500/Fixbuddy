import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, Card, Chip, EmptyState, RetryBanner, Sub, Title } from "../../components/ui";
import RoleArt from "../../components/RoleArt";
import JobCard from "../../components/JobCard";
import { colors, radius, space } from "../../constants/theme";
import { FALLBACK_CATEGORIES, categoryEmoji } from "../../constants/categories";
import { useAuth } from "../../store/AuthContext";
import { CategoryAPI, RequestAPI } from "../../services/requests";
import { greetingName } from "../../utils/role";
import { isEngagedStatus, isPaidStatus, isPendingStatus, statusLabel } from "../../utils/jobStatus";
import type { JobRequest } from "../../types";

export default function CustomerHome() {
  const { user, signedIn, currentJob, jobLocked } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState<{ name: string; icon?: string }[]>(FALLBACK_CATEGORIES.slice(0, 8));
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    void CategoryAPI.list()
      .then((d) => setCats((d.categories || []).slice(0, 8)))
      .catch(() => setCats(FALLBACK_CATEGORIES.slice(0, 8)));
    if (!signedIn) return;
    void RequestAPI.list()
      .then((d) => setJobs(d.requests || []))
      .catch(() => setError("Unable to load jobs."));
  };

  useEffect(() => {
    load();
  }, [signedIn]);

  const pending = jobs.filter((j) => isPendingStatus(j.status) && j.id !== currentJob?.id);
  const done = jobs.filter((j) => isPaidStatus(j.status)).slice(0, 3);

  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 28 }}>
        <View style={styles.hero}>
          <View style={{ flex: 1, gap: 4 }}>
            <Sub>{greetingName(user?.name)}</Sub>
            <Title>What do you need help with?</Title>
            <Text style={styles.loc}>{user?.area || user?.city || "Set your area when you post"}</Text>
          </View>
          <RoleArt role="customer" size={88} />
        </View>
        <RetryBanner error={error} onRetry={load} />
        {jobLocked && currentJob && isEngagedStatus(currentJob.status) ? (
          <Card onPress={() => router.push("/customer/active-job")}>
            <Chip label={statusLabel(currentJob.status)} on />
            <Text style={styles.cardTitle}>{currentJob.category}</Text>
            <Text style={styles.meta}>{currentJob.provider?.name || "Worker assigned"} · Track this job</Text>
          </Card>
        ) : null}
        <View style={styles.grid}>
          {cats.map((c) => (
            <Pressable key={c.name} style={styles.cat} onPress={() => router.push("/customer/create-job")}>
              <Text style={styles.emoji}>{categoryEmoji(c.icon, c.name)}</Text>
              <Text style={styles.catText}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Post a Job" onPress={() => router.push("/customer/create-job")} />
        {pending.length ? <Text style={styles.section}>Open requests</Text> : null}
        {pending.slice(0, 3).map((j) => (
          <JobCard key={j.id} job={j} onPress={() => router.push({ pathname: "/customer/job-details", params: { id: j.id } })} />
        ))}
        {done.length ? <Text style={styles.section}>Completed</Text> : null}
        {done.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
        {signedIn && !pending.length && !currentJob ? (
          <EmptyState title="No jobs yet" body="Post a job and nearby workers will see it." action="Post a Job" onAction={() => router.push("/customer/create-job")} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.lg },
  hero: { flexDirection: "row", alignItems: "center", gap: 8 },
  loc: { color: colors.brand, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cat: { width: "31%", minWidth: 96, backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 6 },
  emoji: { fontSize: 22 },
  catText: { fontWeight: "700", color: colors.navy, fontSize: 12, textAlign: "center" },
  section: { fontWeight: "800", color: colors.navy, marginTop: 4 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.navy, marginTop: 6 },
  meta: { color: colors.muted, marginTop: 4 },
});
