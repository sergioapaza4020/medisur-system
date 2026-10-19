import { apiClient } from '../http/axiosClient';
import type { AppointmentsPage, AppointmentsQuery } from '@/types/appointments';
import type { BookingPatientsPage, PatientSelectionQuery } from '@/types/booking-patient';
import type { ApiResponse } from '@/types/auth';
import type { AvailabilityBlock } from '@/types/availability';

export type Appointment = Omit<AvailabilityBlock, 'version'> & {
  idAppointment: number;
  idPatient: number;
  status: 'RESERVED';
};

export const appointmentsService = {
  async patients(query: PatientSelectionQuery): Promise<BookingPatientsPage> {
    return (await apiClient.get<BookingPatientsPage>('/appointments/patients', { params: query })).data;
  },
  async createForPatient(block: AvailabilityBlock, idPatient: number): Promise<Appointment> {
    return (
      await apiClient.post<ApiResponse<Appointment>>('/appointments/for-patient', {
        idSchedule: block.idSchedule,
        expectedVersion: block.version,
        idPatient,
      })
    ).data.data;
  },
  async mine(query: AppointmentsQuery): Promise<AppointmentsPage> {
    return (await apiClient.get<AppointmentsPage>('/appointments/mine', { params: query })).data;
  },
  async create(block: AvailabilityBlock): Promise<Appointment> {
    return (
      await apiClient.post<ApiResponse<Appointment>>('/appointments', {
        idSchedule: block.idSchedule,
        expectedVersion: block.version,
      })
    ).data.data;
  },
};
