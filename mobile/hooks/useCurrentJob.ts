import { useAuth } from "../store/AuthContext";

export function useCurrentJob() {
  const { currentJob, jobLocked, refreshJob } = useAuth();
  return { currentJob, jobLocked, refreshJob };
}
