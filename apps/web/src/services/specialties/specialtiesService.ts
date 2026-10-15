import { apiClient } from '../http/axiosClient';
import { publicRead } from '../http/publicRead';

import type { SpecialtiesPage, SpecialtiesQuery, SpecialtyWrite } from '@/types/specialties';
import type { SpecialtySelectionPage } from '@/types/doctors';
import type { PaginationQuery } from '@/types/pagination';

export const specialtiesService = {
  publicPage(query: PaginationQuery): Promise<SpecialtySelectionPage> {
    return publicRead('/specialties/public', query);
  },
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
