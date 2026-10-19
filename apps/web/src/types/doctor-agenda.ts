import type { PaginatedResponse, PaginationQuery } from './pagination';
import type { AppointmentStatus } from './appointments';

export interface DoctorAgendaQuery extends PaginationQuery {
  mode?: 'list' | 'calendar';
  date?: string;
  from?: string;
  to?: string;
  status?: AppointmentStatus;
}
export interface DoctorAppointment {
  idAppointment: number;
  patient: { name: string; lastname: string; ci?: string };
  specialty: { name: string };
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  timeZone: 'America/La_Paz';
}
export type DoctorAgendaPage = PaginatedResponse<DoctorAppointment>;
