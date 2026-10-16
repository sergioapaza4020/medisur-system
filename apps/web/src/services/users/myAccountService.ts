import { apiClient } from '../http/axiosClient';
import type { ApiResponse } from '@/types/auth';
import type { AvatarResult, MyAccount, UserFields } from '@/types/users';
import { clearTokens } from '@/utils/http/authCookies';

export const myAccountService = {
  async get(): Promise<MyAccount> {
    return (await apiClient.get<ApiResponse<MyAccount>>('/users/me')).data.data;
  },
  async update(changes: Partial<UserFields>): Promise<MyAccount> {
    const { name, lastname, email, ci } = changes;
    return (await apiClient.patch<ApiResponse<MyAccount>>('/users/me', { name, lastname, email, ci })).data.data;
  },
  async uploadAvatar(file: File): Promise<AvatarResult> {
    const form = new FormData();
    form.append('avatar', file);
    return (
      await apiClient.post<ApiResponse<AvatarResult>>('/users/me/avatar', form, {
        headers: { 'Content-Type': undefined },
        timeout: 60000,
      })
    ).data.data;
  },
  async deleteAvatar(): Promise<AvatarResult> {
    return (await apiClient.delete<ApiResponse<AvatarResult>>('/users/me/avatar')).data.data;
  },
  async changePassword(currentPassword: string, password: string): Promise<void> {
    await apiClient.post('/users/me/password', { currentPassword, password });
    clearTokens();
  },
  async deactivate(): Promise<void> {
    await apiClient.post('/users/me/deactivate');
    clearTokens();
  },
};
