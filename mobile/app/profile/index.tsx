import { Redirect } from "expo-router";
import { useAuth } from "../../store/AuthContext";
import ProfileView from "../../components/ProfileView";

export default function ProfileIndex() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;
  return <ProfileView />;
}
