// src/hooks/useAuth.ts
import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';
import { useApiAdapter } from '../services/ApiProvider';
import { queryClient } from '../core/queryClient';
import { hapticService } from '../services/hapticService';

export function useAuth() {
  const { isAuthenticated, user, userId, isLoading, setAuthenticated, clearAuth } =
    useAuthStore();
  const adapter = useApiAdapter();

  const login = useCallback(
    async (studentId: string, passport: string) => {
      const response = await authService.loginWithCredentials(adapter, studentId, passport);
      setAuthenticated(response.profile);
      hapticService.success();
      return response;
    },
    [adapter, setAuthenticated]
  );

  const logout = useCallback(async () => {
    await authService.logout(adapter);
    queryClient.clear();
    clearAuth();
    hapticService.medium();
  }, [adapter, clearAuth]);

  return {
    isAuthenticated,
    user,
    userId,
    isLoading,
    login,
    logout,
  };
}
