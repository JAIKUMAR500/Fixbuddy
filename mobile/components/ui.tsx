import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, radius, space } from "../constants/theme";
import { formatRupees } from "../utils/money";

export function Screen({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return <View style={[styles.screen, padded && { padding: space.lg }]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <Text style={styles.sub}>{children}</Text>;
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const inner = <View style={styles.card}>{children}</View>;
  if (!onPress) return inner;
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
}) {
  const bg = variant === "primary" ? colors.brand : variant === "danger" ? colors.error : colors.white;
  const color = variant === "ghost" ? colors.brand : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled || loading ? 0.55 : 1, borderWidth: variant === "ghost" ? 1 : 0, borderColor: colors.brand }]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.btnText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <View style={styles.errBox}>
      <Text style={styles.err}>{children}</Text>
    </View>
  );
}

export function Chip({ label, on }: { label: string; on?: boolean }) {
  return (
    <View style={[styles.chip, on && { backgroundColor: colors.brand }]}>
      <Text style={[styles.chipText, on && { color: colors.white }]}>{label}</Text>
    </View>
  );
}

export function Price({ amount }: { amount?: number | null }) {
  return <Text style={styles.price}>{formatRupees(amount)}</Text>;
}

export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.sub}>{body}</Text>
      {action && onAction ? <Button title={action} onPress={onAction} /> : null}
    </View>
  );
}

export function RetryBanner({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <Pressable onPress={onRetry} style={styles.errBox}>
      <Text style={styles.err}>{error}</Text>
      <Text style={styles.retry}>Tap to retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  title: { fontSize: 28, fontWeight: "800", color: colors.navy, letterSpacing: -0.4 },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    minHeight: 52,
  },
  btn: { minHeight: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: "800" },
  errBox: { backgroundColor: "#FEF2F2", borderRadius: radius.md, padding: 12, gap: 4 },
  err: { color: colors.error, fontSize: 14 },
  retry: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  chip: { alignSelf: "flex-start", backgroundColor: colors.brandSoft, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: colors.brand, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  price: { fontSize: 22, fontWeight: "900", color: colors.navy },
  empty: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: 10, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.navy },
});
