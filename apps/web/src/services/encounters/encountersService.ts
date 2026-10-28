import { apiClient } from '../http/axiosClient';
import type { ApiResponse } from '@/types/auth';
import type { CreateEncounter, EncounterReceipt } from '@/types/encounters';

export const encountersService = {
  async create(input: CreateEncounter): Promise<EncounterReceipt> {
    return (await apiClient.post<ApiResponse<EncounterReceipt>>('/encounters', input)).data.data;
  },
};
