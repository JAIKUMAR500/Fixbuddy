import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { EmptyState, RetryBanner, Title } from "../../components/ui";
import AuthGate from "../../components/AuthGate";
import JobCard from "../../components/JobCard";
import { colors, radius, space } from "../../constants/theme";
import { RequestAPI } from "../../services/requests";
import { useAuth } from "../../store/AuthContext";
import { publicRole } from "../../utils/role";
import { isEngagedStatus, isPaidStatus, isPendingStatus } from "../../utils/jobStatus";
import type { JobRequest } from "../../types";

const TABS = ["Pending", "Active", "Completed", "Cancelled"] as const;

export default function Jobs() {
  const { signedIn, user } = useAuth();
  const router = useRouter();
  const role = publicRole(user?.role);
  const postHref = role === "business" ? "/business/create-job" : "/customer/create-job";
  const [rows, setRows] = useState<JobRequest[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Pending");
  const load = () => {
    setError("");
    void RequestAPI.list()
      .then((d) => setRows(d.requests || []))
      .catch(() => setError("Unable to load jobs."));
  };
  useFocusEffect(useCallback(() => { if (signedIn) load(); }, [signedIn]));
  if (!signedIn) return <AuthGate role={role === "business" ? "business" : "customer"} />;

  const filtered = rows.filter((j) => {
    if (tab === "Pending") return isPendingStatus(j.status);
    if (tab === "Active") return isEngagedStatus(j.status);
    if (tab === "Completed") return isPaidStatus(j.status);
    return j.status === "cancelled" || j.status === "declined";
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} contentContainerStyle={{ gap: 10, paddingBottom: 28 }}>
        <Title>Your jobs</Title>
        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabOn]}>
              <Text style={[styles.tabText, tab === item && styles.tabTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <RetryBanner error={error} onRetry={load} />
        {!filtered.length ? (
          <EmptyState
            title={`No ${tab.toLowerCase()} jobs`}
            body={tab === "Pending" ? "Post a job and nearby workers will see it." : "Jobs in this state will show up here."}
            action={tab === "Pending" ? "Post a Job" : undefined}
            onAction={() => router.push(postHref)}
          />
        ) : null}
        {filtered.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            onPress={() => router.push({ pathname: "/customer/job-details", params: { id: j.id } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 6 },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.md, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { fontSize: 11, fontWeight: "800", color: colors.muted },
  tabTextOn: { color: colors.white },
});
