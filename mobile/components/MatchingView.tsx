import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import RoleArt from "./RoleArt";
import { Button, ErrorText } from "./ui";
import { colors, space } from "../constants/theme";
import { RequestAPI } from "../services/requests";
import { ApiError } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { isEngagedStatus, statusLabel } from "../utils/jobStatus";
import type { JobRequest } from "../types";
import { formatRupees, jobAmountRupees } from "../utils/money";

const STAGES = ["Understanding your request…", "Finding nearby workers…", "Matching skills…", "Waiting for a worker to accept…"];

export default function MatchingView({ activeHref, jobsHref }: { activeHref: string; jobsHref: string }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { refreshJob } = useAuth();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (id) {
          const data = await RequestAPI.get(id);
          if (!alive) return;
          setJob(data.request);
          setError("");
          if (isEngagedStatus(data.request.status)) {
            await refreshJob();
            router.replace(activeHref);
          }
          return;
        }
        const data = await RequestAPI.list();
        const latest = (data.requests || [])[0];
        if (latest && alive) setJob(latest);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "Unable to load this job.");
      }
    };
    void load();
    const poll = setInterval(() => void load(), 4000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [id, activeHref, refreshJob, router]);

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <RoleArt kind="ai" size={160} />
        <ActivityIndicator color={colors.white} size="large" />
        <Text style={styles.title}>Finding nearby workers</Text>
        <Text style={styles.body}>{STAGES[stage]}</Text>
        {job ? (
          <Text style={styles.job}>
            {job.category} · {statusLabel(job.status)} · {formatRupees(jobAmountRupees(job))}
          </Text>
        ) : null}
        <ErrorText>{error}</ErrorText>
      </View>
          <Button title="Track in My Jobs" onPress={() => router.replace(jobsHref)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.navy, padding: space.lg, justifyContent: "space-between" },
  title: { fontSize: 28, fontWeight: "800", color: colors.white, textAlign: "center" },
  body: { color: "#CBD5E1", textAlign: "center", fontSize: 16 },
  job: { color: "#93C5FD", fontWeight: "700", textAlign: "center" },
});
