import { apiClient } from '../http/axiosClient';
import type { PaginationQuery } from '@/types/pagination';
import type {
  CreateExtraordinaryGrant,
  DoctorMedicalRecordPage,
  ExtraordinaryGrantsPage,
  PatientMedicalRecordPage,
} from '@/types/medical-records';
import type { PatientSelectionQuery, BookingPatientsPage } from '@/types/booking-patient';
import type { ApiResponse } from '@/types/auth';

export const medicalRecordsService = {
  async grants(query: PaginationQuery, mode: 'manage' | 'mine'): Promise<ExtraordinaryGrantsPage> {
    return (
      await apiClient.get<ExtraordinaryGrantsPage>(
        `/medical-records/extraordinary-access${mode === 'mine' ? '/mine' : ''}`,
        { params: query },
      )
    ).data;
  },
  async people(kind: 'patients' | 'beneficiaries', query: PatientSelectionQuery): Promise<BookingPatientsPage> {
    return (
      await apiClient.get<BookingPatientsPage>(`/medical-records/extraordinary-access/${kind}`, { params: query })
    ).data;
  },
  async grant(input: CreateExtraordinaryGrant) {
    return (
      await apiClient.post<ApiResponse<{ idGrant: number; expiresAt: string }>>(
        '/medical-records/extraordinary-access',
        input,
      )
    ).data.data;
  },
  async revoke(idGrant: number, reason: string) {
    return (
      await apiClient.patch<ApiResponse<{ idGrant: number; revokedAt: string }>>(
        `/medical-records/extraordinary-access/${idGrant}/revoke`,
        { reason },
      )
    ).data.data;
  },
  async byExtraordinaryGrant(idGrant: number, query: PaginationQuery): Promise<DoctorMedicalRecordPage> {
    return (
      await apiClient.get<DoctorMedicalRecordPage>(`/medical-records/by-extraordinary-grant/${idGrant}`, {
        params: query,
      })
    ).data;
  },
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
