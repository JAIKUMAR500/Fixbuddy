import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BrandMark from "../components/BrandMark";
import { Button } from "../components/ui";
import { colors, radius, space, tagline } from "../constants/theme";
import { IMAGES } from "../constants/images";
import { useAuth } from "../store/AuthContext";

const SLIDES = [
  {
    title: "Find trusted local help",
    body: "Plumbing, electrical, cleaning, painting, driver work — nearby people who show up.",
    image: IMAGES.roleCustomer,
  },
  {
    title: "Get the right person nearby",
    body: "We match you with verified workers around your area, not a distant call centre.",
    image: IMAGES.roleWorker,
  },
  {
    title: "Track the job start to finish",
    body: "Accepted → On the way → Arrived → OTP → Working → Completed.",
    image: IMAGES.aiRobot,
  },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const last = i === SLIDES.length - 1;

  const go = async () => {
    await completeOnboarding();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.top}>
        <BrandMark light />
        <Pressable onPress={go} hitSlop={12}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.hero}>
        <Image source={SLIDES[i].image} style={styles.art} resizeMode="contain" />
        <Text style={styles.kicker}>{tagline}</Text>
        <Text style={styles.title}>{SLIDES[i].title}</Text>
        <Text style={styles.body}>{SLIDES[i].body}</Text>
        {i === 2 ? (
          <Text style={styles.track}>Accepted → On the way → Arrived → Working → Completed</Text>
        ) : null}
        <Text style={styles.count}>{i + 1} / 3</Text>
      </View>
      <View style={styles.dots}>
        {SLIDES.map((_, n) => (
          <View key={n} style={[styles.dot, n === i && styles.dotOn]} />
        ))}
      </View>
      <Button title={last ? "Get Started" : "Next"} onPress={() => (last ? void go() : setI(i + 1))} />
      <Pressable onPress={go}>
        <Text style={styles.account}>I already have an account</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.navy, padding: space.lg, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skip: { color: "#93C5FD", fontWeight: "700" },
  account: { color: "#93C5FD", textAlign: "center", fontWeight: "700", marginTop: 12 },
  hero: { gap: 12, alignItems: "center" },
  art: { width: 220, height: 180 },
  kicker: { color: "#93C5FD", fontWeight: "700" },
  title: { color: colors.white, fontSize: 32, fontWeight: "800", lineHeight: 38, textAlign: "center" },
  body: { color: "#CBD5E1", fontSize: 16, lineHeight: 24, textAlign: "center" },
  track: { color: colors.white, fontWeight: "700", textAlign: "center" },
  count: { color: colors.white, fontWeight: "800", marginTop: 8 },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: "#334155" },
  dotOn: { width: 22, backgroundColor: colors.brand },
});
