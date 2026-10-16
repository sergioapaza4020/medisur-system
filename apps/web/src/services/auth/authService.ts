import { apiClient } from '../http/axiosClient';

import type { ApiResponse, AuthUser, LoginCredentials, LoginTokens, PatientRegistration } from '@/types/auth';
import { clearTokens, getRefreshToken, saveTokens } from '@/utils/http/authCookies';

export const authService = {
  async validateRecoveryToken(token: string): Promise<void> {
    await apiClient.post('/auth/reset-password/validate', { token });
  },
  async resetPassword(token: string, password: string, confirmPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password, confirmPassword });
    clearTokens();
  },
  async requestPasswordRecovery(email: string): Promise<string> {
    const { data } = await apiClient.post<ApiResponse<null>>('/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    });
    return (
      data.message ||
      'Si existe una cuenta asociada a este correo, recibirás instrucciones para restablecer tu contraseña.'
    );
  },
  async register(patient: PatientRegistration): Promise<void> {
    await apiClient.post('/auth/register', {
      name: patient.name,
      lastname: patient.lastname,
      email: patient.email.trim().toLowerCase(),
      ci: patient.ci,
      password: patient.password,
    });
  },
  async login(credentials: LoginCredentials, remember = false): Promise<AuthUser> {
    clearTokens();

    try {
      const { data } = await apiClient.post<ApiResponse<LoginTokens>>('/auth/login', {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      });

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
