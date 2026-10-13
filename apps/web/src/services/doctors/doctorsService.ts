import { apiClient } from '../http/axiosClient';

import type { ApiResponse } from '@/types/auth';
import type {
  Doctor,
  DoctorAccountsPage,
  DoctorCreate,
  DoctorsPage,
  DoctorsQuery,
  DoctorSelectionPage,
  SpecialtySelectionPage,
} from '@/types/doctors';
import type { PaginationQuery } from '@/types/pagination';

export const doctorsService = {
  async selectionSpecialties(query: PaginationQuery): Promise<SpecialtySelectionPage> {
    return (await apiClient.get<SpecialtySelectionPage>('/doctors/selection-specialties', { params: query })).data;
  },
  async bySpecialty(id: number, query: PaginationQuery): Promise<DoctorSelectionPage> {
    return (await apiClient.get<DoctorSelectionPage>(`/doctors/by-specialty/${id}`, { params: query })).data;
  },
  async list(query: DoctorsQuery): Promise<DoctorsPage> {
    return (await apiClient.get<DoctorsPage>('/doctors', { params: query })).data;
  },
  async searchUsers(query: DoctorsQuery): Promise<DoctorAccountsPage> {
    return (await apiClient.get<DoctorAccountsPage>('/doctors/registration-users', { params: query })).data;
  },
  async create(doctor: DoctorCreate): Promise<Doctor> {
    return (await apiClient.post<ApiResponse<Doctor>>('/doctors', doctor)).data.data;
  },
  async deactivate(id: number): Promise<void> {
    await apiClient.delete(`/doctors/${id}`);
  },
  async getSpecialties(id: number): Promise<Doctor> {
    return (await apiClient.get<ApiResponse<Doctor>>(`/doctors/${id}/specialties`)).data.data;
  },
  async assignSpecialties(id: number, specialtyIds: number[]): Promise<Doctor> {
    return (await apiClient.put<ApiResponse<Doctor>>(`/doctors/${id}/specialties`, { specialtyIds })).data.data;
  },
  async reactivate(id: number): Promise<void> {
    await apiClient.patch(`/doctors/reactivate/${id}`);
  },
};
