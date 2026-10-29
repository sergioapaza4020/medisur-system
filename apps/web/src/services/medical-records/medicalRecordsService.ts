import { apiClient } from '../http/axiosClient';
import type { PaginationQuery } from '@/types/pagination';
import type { DoctorMedicalRecordPage, PatientMedicalRecordPage } from '@/types/medical-records';

export const medicalRecordsService = {
  async mine(query: PaginationQuery): Promise<PatientMedicalRecordPage> {
    return (await apiClient.get<PatientMedicalRecordPage>('/medical-records/mine', { params: query })).data;
  },
  async byAppointment(idAppointment: number, query: PaginationQuery): Promise<DoctorMedicalRecordPage> {
    return (
      await apiClient.get<DoctorMedicalRecordPage>(`/medical-records/by-appointment/${idAppointment}`, {
        params: query,
      })
    ).data;
  },
};
