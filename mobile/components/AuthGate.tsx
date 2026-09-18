import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BrandMark from "./BrandMark";
import RoleArt from "./RoleArt";
import { Button, Sub, Title } from "./ui";
import { colors, space } from "../constants/theme";

export default function AuthGate({ role = "customer" }: { role?: "customer" | "worker" | "business" }) {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg, justifyContent: "center", gap: 14 }}>
      <BrandMark />
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <RoleArt role={role} size={140} />
      </View>
      <Title>Sign in to post and track jobs</Title>
      <Sub>Preview screens cannot talk to the server. Use the same FixBuddy account as the website — then Post Job, Nearby, Accept and Active Job all work.</Sub>
      <Button title="Sign in" onPress={() => router.replace(`/login?role=${role}`)} />
      <Pressable onPress={() => router.replace(`/signup?role=${role}`)}>
        <Text style={{ textAlign: "center", color: colors.brand, fontWeight: "800" }}>Create an account</Text>
      </Pressable>
    </SafeAreaView>
  );
}
