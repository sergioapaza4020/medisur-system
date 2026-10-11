import { apiClient } from '../http/axiosClient';

import type { CreateRole, RolesPage, RolesQuery, UpdateRole } from '@/types/roles';

export interface RoleOption {
  idRole: number;
  name: string;
  isActive: boolean;
}

export const rolesService = {
  async list(): Promise<RoleOption[]> {
    const options: RoleOption[] = [];
    let page = 1;
    let totalPages: number;

    do {
      const result = await rolesService.listPage({ page, limit: 100, status: 'all' });
      options.push(...result.data);
      totalPages = result.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return options;
  },
  async listPage(query: RolesQuery): Promise<RolesPage> {
    return (await apiClient.get<RolesPage>('/roles', { params: query })).data;
  },
  async create(role: CreateRole): Promise<void> {
    await apiClient.post('/roles', role);
  },
  async update(id: number, role: UpdateRole): Promise<void> {
    await apiClient.patch(`/roles/${id}`, role);
  },
  async deactivate(id: number): Promise<void> {
    await apiClient.delete(`/roles/${id}`);
  },
  async reactivate(id: number): Promise<void> {
    await apiClient.patch(`/roles/reactivate/${id}`);
  },
};
