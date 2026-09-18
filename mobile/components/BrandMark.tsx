import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";
import { IMAGES } from "../constants/images";

export default function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.row}>
      <Image source={IMAGES.logo} style={styles.logo} resizeMode="contain" />
      <Text style={[styles.name, light && { color: colors.white }]}>FixBuddy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 36, height: 36, borderRadius: 10 },
  name: { fontSize: 20, fontWeight: "800", color: colors.navy },
});
