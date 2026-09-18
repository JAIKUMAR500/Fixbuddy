import { SafeAreaView } from "react-native-safe-area-context";
import { Sub, Title } from "../../components/ui";
import { colors, space } from "../../constants/theme";

export default function Help() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space.lg }}>
      <Title>Help</Title>
      <Sub>Support stays the same as the website. Admin is not in this app.</Sub>
    </SafeAreaView>
  );
}
