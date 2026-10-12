import { apiClient } from '../http/axiosClient';

import type { SpecialtiesPage, SpecialtiesQuery, SpecialtyWrite } from '@/types/specialties';

export const specialtiesService = {
  async listPage(query: SpecialtiesQuery): Promise<SpecialtiesPage> {
    return (await apiClient.get<SpecialtiesPage>('/specialties', { params: query })).data;
  },
  async create(specialty: SpecialtyWrite): Promise<void> {
    await apiClient.post('/specialties', specialty);
  },
  async update(id: number, specialty: SpecialtyWrite): Promise<void> {
    await apiClient.patch(`/specialties/${id}`, specialty);
  },
  async deactivate(id: number): Promise<void> {
    await apiClient.delete(`/specialties/${id}`);
  },
  async reactivate(id: number): Promise<void> {
    await apiClient.patch(`/specialties/reactivate/${id}`);
  },
};
