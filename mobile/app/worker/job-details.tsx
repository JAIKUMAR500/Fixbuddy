import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Chip, ErrorText, Price, Sub, Title } from "../../components/ui";
import AuthGate from "../../components/AuthGate";
import VoicePlayer from "../../components/VoicePlayer";
import { colors, space } from "../../constants/theme";
import { RequestAPI } from "../../services/requests";
import { ApiError } from "../../services/api";
import { useAuth } from "../../store/AuthContext";
import { statusLabel } from "../../utils/jobStatus";
import type { JobRequest } from "../../types";

export default function JobDetails() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { signedIn, refreshJob, jobLocked } = useAuth();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !signedIn) return;
    void RequestAPI.get(id).then((d) => setJob(d.request)).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load job"));
  }, [id, signedIn]);

  if (!signedIn) return <AuthGate role="worker" />;

  const accept = async () => {
    if (!id || busy) return;
    setError("");
    setBusy(true);
    try {
      await RequestAPI.accept(id);
      await refreshJob();
      router.replace("/worker/active-job");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "This job was just taken.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        <Title>{job?.category || "Job"}</Title>
        <Chip label={statusLabel(job?.status)} />
        <Price amount={job?.estimatedAmount || job?.workerQuote} />
        <Sub>{job?.description}</Sub>
        {job?.voiceNote ? <VoicePlayer url={job.voiceNote} /> : null}
        <Card>
          <Sub>{job?.area || job?.city}</Sub>
          <Sub>{job?.distanceKm != null ? `${Number(job.distanceKm).toFixed(1)} km` : job?.distance || ""}</Sub>
          <Sub>{job?.scheduledLabel || job?.timing}</Sub>
        </Card>
        {jobLocked ? <Sub>You already have an active FixBuddy job. Complete it before accepting another.</Sub> : null}
        <ErrorText>{error}</ErrorText>
        <Button title="Accept job" loading={busy} disabled={jobLocked} onPress={() => void accept()} />
      </ScrollView>
    </SafeAreaView>
  );
}
