import { apiClient } from '../http/axiosClient';

import type { ApiResponse } from '@/types/auth';

export interface RoleOption {
  idRole: number;
  name: string;
  isActive: boolean;
}

export const rolesService = {
  async list(): Promise<RoleOption[]> {
    return (await apiClient.get<ApiResponse<RoleOption[]>>('/roles')).data.data;
  },
};
