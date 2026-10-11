import { apiClient } from '../http/axiosClient';

import type { PermissionsPage, PermissionsQuery } from '@/types/permissions';

export const permissionsService = {
  async listPage(query: PermissionsQuery): Promise<PermissionsPage> {
    return (await apiClient.get<PermissionsPage>('/permissions', { params: query })).data;
  },
};
