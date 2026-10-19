import { apiClient } from '../http/axiosClient';
import type { ApiResponse } from '@/types/auth';
import type { AvailabilityBlock } from '@/types/availability';

export type Appointment = Omit<AvailabilityBlock, 'version'> & {
  idAppointment: number;
  idPatient: number;
  status: 'RESERVED';
};

export const appointmentsService = {
  async create(block: AvailabilityBlock): Promise<Appointment> {
    return (
      await apiClient.post<ApiResponse<Appointment>>('/appointments', {
        idSchedule: block.idSchedule,
        expectedVersion: block.version,
      })
    ).data.data;
  },
};
