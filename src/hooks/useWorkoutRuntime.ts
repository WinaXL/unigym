import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';

export function useWorkoutRuntime() {
  const userId = useAuthStore((state) => state.userId);
  useEffect(() => {
    void useWorkoutStore.getState().load(userId);
  }, [userId]);
  useEffect(() => {
    const refresh = () => useWorkoutStore.getState().refreshDate();
    refresh();
    const timer = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
}
