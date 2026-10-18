import { apiClient } from '../http/axiosClient';
import type { AvailabilityPage, AvailabilityQuery } from '@/types/availability';
import type { ApiResponse } from '@/types/auth';
import type { PaginatedResponse, PaginationQuery } from '@/types/pagination';

export type ScheduleCreate = { idSpecialty: number; date: string; startTime: string; endTime: string };
export type Schedule = ScheduleCreate & { idSchedule: number; idDoctor: number; isActive: boolean };
export type ScheduleSpecialties = PaginatedResponse<{ idSpecialty: number; name: string }>;

export const schedulesService = {
  async availability(query: AvailabilityQuery): Promise<AvailabilityPage> {
    return (await apiClient.get<AvailabilityPage>('/schedules/availability', { params: query })).data;
  },
  async specialties(query: PaginationQuery): Promise<ScheduleSpecialties> {
    return (await apiClient.get<ScheduleSpecialties>('/schedules/specialties', { params: query })).data;
  },
  async create(dto: ScheduleCreate): Promise<Schedule> {
    return (await apiClient.post<ApiResponse<Schedule>>('/schedules', dto)).data.data;
  },
};
