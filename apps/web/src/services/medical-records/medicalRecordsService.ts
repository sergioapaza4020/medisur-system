import { apiClient } from '../http/axiosClient';
import type { PaginationQuery } from '@/types/pagination';
import type { DoctorMedicalRecordPage } from '@/types/medical-records';

export const medicalRecordsService = {
  async byAppointment(idAppointment: number, query: PaginationQuery): Promise<DoctorMedicalRecordPage> {
    return (
      await apiClient.get<DoctorMedicalRecordPage>(`/medical-records/by-appointment/${idAppointment}`, {
        params: query,
      })
    ).data;
  },
};
