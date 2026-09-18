import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ErrorText, Field, Sub, Title } from "../../components/ui";
import { colors, space } from "../../constants/theme";
import { useAuth } from "../../store/AuthContext";
import { RequestAPI } from "../../services/requests";
import { ApiError } from "../../services/api";

export default function Review() {
  const { currentJob, refreshJob } = useAuth();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!currentJob?.id) return;
    setBusy(true);
    try {
      await RequestAPI.review(currentJob.id, { rating: Number(rating), comment });
      await refreshJob();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not submit review");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg, gap: 12 }}>
      <Title>How was your experience?</Title>
      <Sub>Uses POST /requests/:id/review</Sub>
      <Field label="Stars 1–5" keyboardType="number-pad" value={rating} onChangeText={setRating} />
      <Field label="Comment" value={comment} onChangeText={setComment} />
      <ErrorText>{error}</ErrorText>
      <Button title="Submit review" loading={busy} onPress={() => void submit()} />
    </SafeAreaView>
  );
}
