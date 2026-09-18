import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BrandMark from "../../components/BrandMark";
import RoleArt from "../../components/RoleArt";
import { Button, ErrorText, Field } from "../../components/ui";
import { colors, radius, space } from "../../constants/theme";
import { useAuth } from "../../store/AuthContext";
import { ApiError } from "../../services/api";
import { homePath } from "../../utils/role";

const ROLES = ["customer", "worker", "business"] as const;

export default function Signup() {
  const { signup } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initial = ROLES.includes(params.role as (typeof ROLES)[number]) ? (params.role as (typeof ROLES)[number]) : "customer";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Name, email and a password of at least 6 characters are required.");
      return;
    }
    setBusy(true);
    try {
      const user = await signup({ name: name.trim(), email: email.trim(), password, role });
      router.replace(homePath(user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to complete authentication");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <BrandMark />
        <View style={{ alignItems: "center" }}>
          <RoleArt role={role} size={110} />
        </View>
        <Text style={styles.h}>Create your account</Text>
        <Text style={styles.p}>Name, email and password are enough. Extra details can wait.</Text>
        <View style={styles.roles}>
          {ROLES.map((item) => (
            <Pressable key={item} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleOn]}>
              <RoleArt role={item} size={36} />
              <Text style={[styles.roleText, role === item && styles.roleTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Field label={role === "business" ? "Business name" : "Full name"} value={name} onChangeText={setName} />
        <Field label="Email" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
        <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <ErrorText>{error}</ErrorText>
        <Button title="Create account" loading={busy} onPress={() => void submit()} />
        <Link href={`/login?role=${role}`} style={styles.link}>Already have an account</Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.lg },
  h: { fontSize: 28, fontWeight: "800", color: colors.navy },
  p: { color: colors.muted },
  roles: { flexDirection: "row", gap: 8 },
  role: { flex: 1, minHeight: 72, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8 },
  roleOn: { backgroundColor: colors.brandSoft, borderColor: colors.brand, borderWidth: 2 },
  roleText: { textTransform: "capitalize", fontWeight: "700", color: colors.text, fontSize: 12 },
  roleTextOn: { color: colors.brand },
  link: { textAlign: "center", color: colors.brand, fontWeight: "700" },
});
