import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from '@/utils/http/authCookies';
import type { ApiResponse } from '@/types/auth';

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();

  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isAuthenticationRequest = ['/auth/login', '/auth/refresh-access-token'].includes(originalRequest?.url ?? '');

    if (error.response?.status !== 401 || !originalRequest || isAuthenticationRequest) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();

    if (!originalRequest._retry && refreshToken) {
      originalRequest._retry = true;
      let accessToken: string;

      try {
        if (!refreshPromise) {
          refreshPromise = apiClient
            .post<ApiResponse<{ accessToken: string }>>('/auth/refresh-access-token', { refreshToken })
            .then(({ data }) => {
              // A logout or another login must not be undone by an older refresh.
              if (getRefreshToken() !== refreshToken) throw new Error('La sesión ha cambiado');
              setAccessToken(data.data.accessToken);

              return data.data.accessToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        accessToken = await refreshPromise;
      } catch (refreshError) {
        if (getRefreshToken() === refreshToken) expireSession();

        return Promise.reject(refreshError);
      }

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return apiClient(originalRequest);
    }

    expireSession();

    return Promise.reject(error);
  },
);

function expireSession() {
  clearTokens();

  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

export default apiClient;
