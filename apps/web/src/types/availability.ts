import type { PaginatedResponse, PaginationQuery } from './pagination';

export interface AvailabilityQuery extends PaginationQuery {
  idDoctor: number;
  idSpecialty?: number;
  date?: string;
  from?: string;
  to?: string;
}
export interface AvailabilityBlock {
  idSchedule: number;
  idDoctor: number;
  idSpecialty: number;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: 'America/La_Paz';
}
export type AvailabilityPage = PaginatedResponse<AvailabilityBlock>;
