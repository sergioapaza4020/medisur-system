import type { PaginatedResponse, PaginationQuery } from './pagination';

export type AppointmentStatus = 'RESERVED' | 'CANCELLED' | 'RESCHEDULED';
export interface PatientAppointment {
  idAppointment: number;
  doctor: { name: string; lastname: string };
  specialty: { name: string };
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  cancellationReason?: string | null;
  timeZone: 'America/La_Paz';
}
export interface AppointmentsQuery extends PaginationQuery {
  period: 'upcoming' | 'past' | 'all';
  status?: AppointmentStatus;
  date?: string;
}
export type AppointmentsPage = PaginatedResponse<PatientAppointment>;
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  RESERVED: 'Reservada',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reprogramada',
};
