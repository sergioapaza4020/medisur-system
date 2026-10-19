import type { PaginatedResponse, PaginationQuery } from './pagination';

export type AppointmentStatus = 'RESERVED';
export interface PatientAppointment {
  idAppointment: number;
  doctor: { name: string; lastname: string };
  specialty: { name: string };
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  timeZone: 'America/La_Paz';
}
export interface AppointmentsQuery extends PaginationQuery {
  period: 'upcoming' | 'past' | 'all';
  status?: AppointmentStatus;
  date?: string;
}
export type AppointmentsPage = PaginatedResponse<PatientAppointment>;
export const appointmentStatusLabels: Record<AppointmentStatus, string> = { RESERVED: 'Reservada' };
