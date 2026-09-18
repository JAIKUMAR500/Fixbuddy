import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { mediaUrl } from "../services/media";
import { colors, radius } from "../constants/theme";

export default function VoicePlayer({ url }: { url?: string | null }) {
  const src = mediaUrl(url);
  if (!src) return null;
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => void Linking.openURL(src)} style={styles.btn}>
        <Text style={styles.icon}>▶</Text>
        <Text style={styles.label}>Play voice note</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  icon: { color: colors.white, fontSize: 16, fontWeight: "800" },
  label: { color: colors.white, fontWeight: "800", fontSize: 15 },
});
