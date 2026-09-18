import { SafeAreaView } from "react-native-safe-area-context";
import { Sub, Title } from "../../components/ui";
import { colors, space } from "../../constants/theme";

export default function Settings() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <Title>Settings</Title>
      <Sub>Account edits use PATCH /auth/me — wired in a later pass.</Sub>
    </SafeAreaView>
  );
}
