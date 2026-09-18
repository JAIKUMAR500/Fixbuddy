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
import { activeJobPath, homePath } from "../../utils/role";
import { isEngagedStatus } from "../../utils/jobStatus";

const ROLES = ["customer", "worker", "business"] as const;

export default function Login() {
  const { login, refreshJob } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initial = ROLES.includes(params.role as (typeof ROLES)[number]) ? (params.role as (typeof ROLES)[number]) : "customer";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter the email or mobile number and password you used on the website.");
      return;
    }
    setBusy(true);
    try {
      const user = await login(email, password, role);
      const job = await refreshJob();
      if (job && isEngagedStatus(job.status)) router.replace(activeJobPath(user.role));
      else router.replace(homePath(user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to complete authentication");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32, justifyContent: "center", flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <BrandMark />
        <View style={{ alignItems: "center" }}>
          <RoleArt role={role} size={120} />
        </View>
        <Text style={styles.h}>Welcome back 👋</Text>
        <Text style={styles.p}>Same FixBuddy account as the website. Admin stays on web.</Text>
        <View style={styles.roles}>
          {ROLES.map((item) => (
            <Pressable key={item} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleOn]}>
              <RoleArt role={item} size={36} />
              <Text style={[styles.roleText, role === item && styles.roleTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Email or mobile" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
        <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Link href="/forgot" style={styles.forgot}>Forgot password?</Link>
        <ErrorText>{error}</ErrorText>
        <Button title="Continue" loading={busy} onPress={() => void submit()} />
        <Link href={`/signup?role=${role}`} style={styles.link}>Create an account</Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.lg },
  h: { fontSize: 30, fontWeight: "800", color: colors.navy },
  p: { color: colors.muted, marginBottom: 4 },
  roles: { flexDirection: "row", gap: 8 },
  role: { flex: 1, minHeight: 72, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8 },
  roleOn: { backgroundColor: colors.brandSoft, borderColor: colors.brand, borderWidth: 2 },
  roleText: { textTransform: "capitalize", fontWeight: "700", color: colors.text, fontSize: 12 },
  roleTextOn: { color: colors.brand },
  forgot: { alignSelf: "flex-end", color: colors.brand, fontWeight: "700" },
  link: { textAlign: "center", color: colors.brand, fontWeight: "700", marginTop: 8 },
});
