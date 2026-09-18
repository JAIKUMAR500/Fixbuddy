import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, Sub, Title } from "./ui";
import RoleArt from "./RoleArt";
import { colors, space } from "../constants/theme";
import { useAuth } from "../store/AuthContext";
import { publicRole } from "../utils/role";
import { mediaUrl } from "../services/media";

export default function ProfileView() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const role = publicRole(user?.role);
  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView contentContainerStyle={{ gap: 12, alignItems: "center" }}>
        {user?.avatar ? (
          <Image source={{ uri: mediaUrl(user.avatar) }} style={styles.avatar} />
        ) : (
          <RoleArt role={role} size={120} />
        )}
        <Title>{user?.name || "Profile"}</Title>
        <Sub>{role.toUpperCase()} · {user?.email}</Sub>
        <Text style={styles.line}>{user?.area || user?.city || "Location not set"}</Text>
        <Text style={styles.line}>Admin tools stay on the website.</Text>
        <View style={{ width: "100%", gap: 10, marginTop: 12 }}>
          <Button title="Help" variant="ghost" onPress={() => router.push("/profile/help")} />
          <Button title="Log out" variant="danger" onPress={() => { void logout(); router.replace("/login"); }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.lg },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandSoft },
  line: { color: colors.muted, textAlign: "center" },
});
