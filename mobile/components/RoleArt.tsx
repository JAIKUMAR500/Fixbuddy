import { Image, StyleSheet, View } from "react-native";
import { IMAGES, roleImage } from "../constants/images";

export default function RoleArt({
  role,
  kind,
  size = 96,
}: {
  role?: string | null;
  kind?: "customer" | "worker" | "business" | "ai" | "logo";
  size?: number;
}) {
  const source =
    kind === "ai" ? IMAGES.aiRobot : kind === "logo" ? IMAGES.logo : roleImage(kind || role);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
