import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ErrorText, Field } from "../../components/ui";
import { colors, space } from "../../constants/theme";
import { AuthAPI, ApiError, persistSession } from "../../services/api";
import { useAuth } from "../../store/AuthContext";
import { homePath } from "../../utils/role";

type Step = "email" | "otp" | "password";

export default function Forgot() {
  const router = useRouter();
  const { refreshJob } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setError("");
    setBusy(true);
    try {
      const d = await AuthAPI.forgot(email.trim());
      setInfo(d.message);
      setStep("otp");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { token, user } = await AuthAPI.reset({ email: email.trim(), otp, password });
      await persistSession(token);
      await refreshJob();
      router.replace(homePath(user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap}>
      <Text style={styles.h}>Reset password</Text>
      <Text style={styles.p}>
        {step === "email" && "Enter the email on your account. We will send a 6-digit OTP."}
        {step === "otp" && `Enter the OTP sent to ${email}.`}
        {step === "password" && "Choose a new password, then you can sign in."}
      </Text>
      {step === "email" ? <Field label="Email" autoCapitalize="none" value={email} onChangeText={setEmail} /> : null}
      {step === "otp" ? <Field label="6-digit OTP" keyboardType="number-pad" value={otp} onChangeText={setOtp} /> : null}
      {step === "password" ? <Field label="New password" secureTextEntry value={password} onChangeText={setPassword} /> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <ErrorText>{error}</ErrorText>
      {step === "email" ? <Button title="Send OTP" loading={busy} onPress={() => void send()} /> : null}
      {step === "otp" ? <Button title="Continue" onPress={() => setStep("password")} /> : null}
      {step === "password" ? <Button title="Save password" loading={busy} onPress={() => void save()} /> : null}
      <Link href="/login" style={styles.link}>Back to login</Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.lg, gap: 12, justifyContent: "center" },
  h: { fontSize: 28, fontWeight: "800", color: colors.navy },
  p: { color: colors.muted },
  info: { color: colors.success },
  link: { textAlign: "center", color: colors.brand, fontWeight: "700" },
});
