import { Tabs } from "expo-router";
import TabIcon from "../../components/TabIcon";
import { colors } from "../../constants/theme";

export default function CustomerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { height: 72, paddingBottom: 10, paddingTop: 8, backgroundColor: colors.white, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: "800", fontSize: 12 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
      <Tabs.Screen name="create-job" options={{ title: "Post", tabBarIcon: () => <TabIcon emoji="➕" /> }} />
      <Tabs.Screen name="active-job" options={{ title: "Active", tabBarIcon: () => <TabIcon emoji="📍" /> }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: () => <TabIcon emoji="📋" /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: () => <TabIcon emoji="👤" /> }} />
      <Tabs.Screen name="job-details" options={{ href: null }} />
      <Tabs.Screen name="review" options={{ href: null }} />
      <Tabs.Screen name="matching" options={{ href: null }} />
    </Tabs>
  );
}
