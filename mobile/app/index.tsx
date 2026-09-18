import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "../store/AuthContext";
import { colors, tagline } from "../constants/theme";
import { activeJobPath, homePath } from "../utils/role";
import { isEngagedStatus } from "../utils/jobStatus";

export default function Index() {
  const { ready, onboarded, user, currentJob, jobLocked } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Text style={{ color: colors.white, fontSize: 32, fontWeight: "900" }}>FixBuddy</Text>
        <Text style={{ color: "#93C5FD" }}>{tagline}</Text>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (!onboarded && !user) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/login" />;
  if (jobLocked && currentJob && isEngagedStatus(currentJob.status)) {
    return <Redirect href={activeJobPath(user.role)} />;
  }
  return <Redirect href={homePath(user.role)} />;
}
