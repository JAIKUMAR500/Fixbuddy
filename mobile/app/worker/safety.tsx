import { SafeAreaView } from "react-native-safe-area-context";
import { Sub, Title } from "../../components/ui";
import { colors, space } from "../../constants/theme";

export default function Safety() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg, gap: 12 }}>
      <Title>Safety</Title>
      <Sub>SOS uses POST /api/safety/incidents. It records an incident on the server. It does not call emergency services.</Sub>
    </SafeAreaView>
  );
}
