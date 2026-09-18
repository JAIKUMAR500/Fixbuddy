import { SafeAreaView } from "react-native-safe-area-context";
import { Sub, Title } from "../../components/ui";
import { colors, space } from "../../constants/theme";

export default function Workers() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg, gap: 12 }}>
      <Title>Team</Title>
      <Sub>Crew APIs live at /api/crews and /api/team. Full crew UI is Phase 6.</Sub>
    </SafeAreaView>
  );
}
