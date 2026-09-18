import { Tabs } from "expo-router";
import TabIcon from "../../components/TabIcon";
import { colors } from "../../constants/theme";

export default function BusinessTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { height: 72, paddingBottom: 10, paddingTop: 8, backgroundColor: colors.white },
        tabBarLabelStyle: { fontWeight: "800", fontSize: 12 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: () => <TabIcon emoji="🏢" /> }} />
      <Tabs.Screen name="create-job" options={{ title: "Post", tabBarIcon: () => <TabIcon emoji="➕" /> }} />
      <Tabs.Screen name="active-job" options={{ title: "Active", tabBarIcon: () => <TabIcon emoji="📍" /> }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: () => <TabIcon emoji="📋" /> }} />
      <Tabs.Screen name="workers" options={{ title: "Team", tabBarIcon: () => <TabIcon emoji="👥" /> }} />
      <Tabs.Screen name="matching" options={{ href: null }} />
    </Tabs>
  );
}
