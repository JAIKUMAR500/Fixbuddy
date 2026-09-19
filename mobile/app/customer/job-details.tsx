import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Chip, ErrorText, Sub, Title } from "../../components/ui";
import VoicePlayer from "../../components/VoicePlayer";
import { colors, space } from "../../constants/theme";
import { RequestAPI } from "../../services/requests";
import { ApiError } from "../../services/api";
import { useAuth } from "../../store/AuthContext";
import { isEngagedStatus, isPendingStatus, statusLabel } from "../../utils/jobStatus";
import type { JobRequest } from "../../types";
import { formatRupees, jobAmountRupees } from "../../utils/money";

export default function JobDetails() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { refreshJob } = useAuth();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    void RequestAPI.get(id)
      .then((d) => setJob(d.request))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load job"));
  }, [id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        <Title>{job?.category || "Job"}</Title>
        <Chip label={statusLabel(job?.status)} />
        <Sub>{job?.description}</Sub>
        {job?.voiceNote ? <VoicePlayer url={job.voiceNote} /> : null}
        <Card>
          <Sub>{[job?.address, job?.area, job?.city].filter(Boolean).join(", ")}</Sub>
          <Sub>{formatRupees(jobAmountRupees(job))}</Sub>
          <Sub>{job?.scheduledLabel || job?.timing}</Sub>
        </Card>
        <ErrorText>{error}</ErrorText>
        {job && isEngagedStatus(job.status) ? (
          <Button title="Open active job" onPress={() => { void refreshJob(); router.replace("/customer/active-job"); }} />
        ) : null}
        {job && isPendingStatus(job.status) ? (
          <Button title="Finding workers" variant="ghost" onPress={() => router.replace({ pathname: "/customer/matching", params: { id: job.id } })} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
