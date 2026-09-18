import { SafeAreaView } from "react-native-safe-area-context";
import { Sub, Title } from "../../components/ui";
import { colors, space } from "../../constants/theme";

export default function Notifications() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <Title>Notifications</Title>
      <Sub>GET /api/notifications. Push (Expo Notifications) is Phase 5.</Sub>
    </SafeAreaView>
  );
}
