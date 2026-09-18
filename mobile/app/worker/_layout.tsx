import { Tabs } from "expo-router";
import TabIcon from "../../components/TabIcon";
import { colors } from "../../constants/theme";

export default function WorkerTabs() {
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
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
      <Tabs.Screen name="nearby-jobs" options={{ title: "Nearby", tabBarIcon: () => <TabIcon emoji="🔍" /> }} />
      <Tabs.Screen name="active-job" options={{ title: "Active", tabBarIcon: () => <TabIcon emoji="📍" /> }} />
      <Tabs.Screen name="earnings" options={{ title: "Earnings", tabBarIcon: () => <TabIcon emoji="💰" /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: () => <TabIcon emoji="👤" /> }} />
      <Tabs.Screen name="job-details" options={{ href: null }} />
      <Tabs.Screen name="target" options={{ href: null }} />
      <Tabs.Screen name="skill-passport" options={{ href: null }} />
      <Tabs.Screen name="safety" options={{ href: null }} />
    </Tabs>
  );
}
