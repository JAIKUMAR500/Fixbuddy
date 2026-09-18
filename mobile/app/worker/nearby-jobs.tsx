import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { EmptyState, RetryBanner, Sub, Title } from "../../components/ui";
import AuthGate from "../../components/AuthGate";
import JobCard from "../../components/JobCard";
import { colors, space } from "../../constants/theme";
import { RequestAPI } from "../../services/requests";
import { useAuth } from "../../store/AuthContext";
import { isPendingStatus } from "../../utils/jobStatus";
import type { JobRequest } from "../../types";

export default function Nearby() {
  const { signedIn } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<JobRequest[]>([]);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    void RequestAPI.list("?inbox=true")
      .then((d) => setRows((d.requests || []).filter((j) => isPendingStatus(j.status))))
      .catch(() => setError("Unable to load jobs."));
  };
  useFocusEffect(useCallback(() => { if (signedIn) load(); }, [signedIn]));
  if (!signedIn) return <AuthGate role="worker" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} contentContainerStyle={{ gap: 10, paddingBottom: 28 }}>
        <Title>Nearby jobs</Title>
        <Sub>Open jobs from the same inbox as the website. Accept uses WorkerLock on the server.</Sub>
        <RetryBanner error={error} onRetry={load} />
        {!rows.length && !error ? (
          <EmptyState title="No nearby jobs right now." body="Pull down to refresh. New customer posts appear here." action="Refresh" onAction={load} />
        ) : null}
        {rows.map((j) => (
          <JobCard key={j.id} job={j} onPress={() => router.push({ pathname: "/worker/job-details", params: { id: j.id } })} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
