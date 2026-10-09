import { apiClient } from '../http/axiosClient';

import type { ApiResponse, AuthUser, LoginCredentials, LoginTokens } from '@/types/auth';
import { clearTokens, getRefreshToken, saveTokens } from '@/utils/http/authCookies';

export const authService = {
  async login(credentials: LoginCredentials, remember = false): Promise<AuthUser> {
    clearTokens();

    try {
      const { data } = await apiClient.post<ApiResponse<LoginTokens>>('/auth/login', credentials);

      saveTokens(data.data.accessToken, data.data.refreshToken, remember);

      return await authService.getCurrentUser();
    } catch (error) {
      clearTokens();
      throw error;
    }
  },

  async getCurrentUser(): Promise<AuthUser> {
    const { data } = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');

    return data.data;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) await apiClient.post('/sessions/logout', { refreshToken });
    } finally {
      clearTokens();
    }
  },
};
