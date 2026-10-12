import { apiClient } from '../http/axiosClient';

import type { ApiResponse } from '@/types/auth';
import type { Doctor, DoctorAccountsPage, DoctorCreate, DoctorsPage, DoctorsQuery } from '@/types/doctors';

export const doctorsService = {
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
  async reactivate(id: number): Promise<void> {
    await apiClient.patch(`/doctors/reactivate/${id}`);
  },
};
