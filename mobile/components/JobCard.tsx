import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Chip, Price } from "./ui";
import { jobAmountRupees } from "../utils/money";
import { categoryEmoji } from "../constants/categories";
import { statusLabel } from "../utils/jobStatus";
import type { JobRequest } from "../types";

export default function JobCard({ job, onPress, caption }: { job: JobRequest; onPress?: () => void; caption?: string }) {
  const amount = jobAmountRupees(job);
  const dist = job.distance || (job.distanceKm != null ? `${Number(job.distanceKm).toFixed(1)} km` : "");
  return (
    <Card onPress={onPress}>
      <View style={styles.top}>
        <Text style={styles.emoji}>{categoryEmoji(undefined, job.category)}</Text>
        <View style={{ flex: 1 }}>
          <Chip label={statusLabel(job.status)} />
          <Text style={styles.cat}>{job.category || "Job"}</Text>
        </View>
        <Price amount={amount} />
      </View>
      <Text style={styles.meta} numberOfLines={2}>
        {caption || [dist, job.area || job.city, job.scheduledLabel || job.timing].filter(Boolean).join(" · ")}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoji: { fontSize: 28 },
  cat: { fontSize: 18, fontWeight: "800", color: colors.navy, marginTop: 4 },
  meta: { color: colors.muted, marginTop: 8, fontSize: 13 },
});
