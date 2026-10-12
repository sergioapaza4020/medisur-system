import { apiClient } from '../http/axiosClient';

import type { ApiResponse, PatientRegistration } from '@/types/auth';
import type { PatientRegistrationMatches } from '@/types/users';
import type { AdministrativeUser, CreateUser, UpdateUser, UsersPage, UsersQuery } from '@/types/users';

export const usersService = {
  async searchForPatientRegistration(query: UsersQuery): Promise<PatientRegistrationMatches> {
    return (await apiClient.get<PatientRegistrationMatches>('/users/patient-registration', { params: query })).data;
  },
  async createPatient(patient: PatientRegistration): Promise<{ idUser: number; email: string }> {
    return (
      await apiClient.post<ApiResponse<{ idUser: number; email: string }>>('/users/patient-registration', {
        name: patient.name,
        lastname: patient.lastname,
        email: patient.email,
        ci: patient.ci,
        password: patient.password,
      })
    ).data.data;
  },
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
