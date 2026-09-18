import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, EmptyState, RetryBanner, Sub, Title } from "../../components/ui";
import AuthGate from "../../components/AuthGate";
import JobCard from "../../components/JobCard";
import RoleArt from "../../components/RoleArt";
import { colors, space } from "../../constants/theme";
import { RequestAPI } from "../../services/requests";
import { useAuth } from "../../store/AuthContext";
import { greetingName } from "../../utils/role";
import { isEngagedStatus, isPendingStatus } from "../../utils/jobStatus";
import type { JobRequest } from "../../types";

export default function BusinessHome() {
  const { user, signedIn, currentJob, jobLocked } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<JobRequest[]>([]);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    void RequestAPI.list()
      .then((d) => setRows(d.requests || []))
      .catch(() => setError("Unable to load jobs."));
  };
  useFocusEffect(useCallback(() => { if (signedIn) load(); }, [signedIn]));
  if (!signedIn) return <AuthGate role="business" />;
  const active = rows.filter((j) => isEngagedStatus(j.status) || isPendingStatus(j.status));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} contentContainerStyle={{ gap: 12, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Sub>{greetingName(user?.name)}</Sub>
            <Title>{user?.provider?.businessName || user?.name || "Business"}</Title>
          </View>
          <RoleArt role="business" size={84} />
        </View>
        <Button title="Post a job" onPress={() => router.push("/business/create-job")} />
        <RetryBanner error={error} onRetry={load} />
        {jobLocked && currentJob ? (
          <JobCard job={currentJob} onPress={() => router.push("/business/active-job")} />
        ) : null}
        {active.filter((j) => j.id !== currentJob?.id).map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
        {!active.length ? (
          <EmptyState title="No active jobs" body="Post a job and workers nearby will see it." action="Post a job" onAction={() => router.push("/business/create-job")} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
