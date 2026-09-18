import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../store/AuthContext";
import { colors } from "../constants/theme";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="customer" />
        <Stack.Screen name="worker" />
        <Stack.Screen name="business" />
        <Stack.Screen name="profile" />
      </Stack>
    </AuthProvider>
  );
}
