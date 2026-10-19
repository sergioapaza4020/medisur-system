import { apiClient } from '../http/axiosClient';
import type { AvailabilityPage, AvailabilityQuery } from '@/types/availability';
import type { ApiResponse } from '@/types/auth';
import type { PaginatedResponse, PaginationQuery } from '@/types/pagination';

export type ScheduleCreate = { idSpecialty: number; date: string; startTime: string; endTime: string };
export type Schedule = ScheduleCreate & {
  idSchedule: number;
  idDoctor: number;
  isActive: boolean;
  version: number;
  specialtyName?: string;
};
export type ScheduleSpecialties = PaginatedResponse<{ idSpecialty: number; name: string }>;

export type ScheduleUpdate = ScheduleCreate & { isActive: boolean; expectedVersion: number };
export type SchedulesPage = PaginatedResponse<Schedule>;

export const schedulesService = {
  async mine(query: PaginationQuery): Promise<SchedulesPage> {
    return (await apiClient.get<SchedulesPage>('/schedules/mine', { params: query })).data;
  },
  async update(id: number, dto: ScheduleUpdate): Promise<Schedule> {
    return (await apiClient.put<ApiResponse<Schedule>>(`/schedules/${id}`, dto)).data.data;
  },
  async availability(query: AvailabilityQuery): Promise<AvailabilityPage> {
    return (await apiClient.get<AvailabilityPage>('/schedules/availability', { params: query })).data;
  },
  async specialties(query: PaginationQuery, editing = false): Promise<ScheduleSpecialties> {
    return (
      await apiClient.get<ScheduleSpecialties>(editing ? '/schedules/editing-specialties' : '/schedules/specialties', {
        params: query,
      })
    ).data;
  },
  async create(dto: ScheduleCreate): Promise<Schedule> {
    return (await apiClient.post<ApiResponse<Schedule>>('/schedules', dto)).data.data;
  },
};
