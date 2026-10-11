import { apiClient } from '../http/axiosClient';

import type { ApiResponse } from '@/types/auth';
import type { AdministrativeUser, CreateUser, UpdateUser, UsersPage, UsersQuery } from '@/types/users';

export const usersService = {
  async list(query: UsersQuery): Promise<UsersPage> {
    return (await apiClient.get<UsersPage>('/users', { params: query })).data;
  },
  async get(id: number): Promise<AdministrativeUser> {
    return (await apiClient.get<ApiResponse<AdministrativeUser>>(`/users/id/${id}`)).data.data;
  },
  async create(user: CreateUser): Promise<void> {
    await apiClient.post('/users', user);
  },
  async update(id: number, user: UpdateUser): Promise<void> {
    await apiClient.patch(`/users/${id}`, user);
  },
  async deactivate(id: number): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
  async replaceRoles(id: number, roleNames: string[]): Promise<void> {
    await apiClient.put(`/users/assign-roles/${id}`, { roleNames });
  },
  async reactivate(id: number): Promise<void> {
    await apiClient.patch(`/users/reactivate/${id}`);
  },
};
