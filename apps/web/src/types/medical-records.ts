import type { PaginatedResponse } from './pagination';

export interface DoctorMedicalEncounter {
  idEncounter: number;
  occurredAt: string;
  summary: string;
  doctor: { name: string; lastname: string };
  specialty: { name: string };
}

export type DoctorMedicalRecordPage = PaginatedResponse<DoctorMedicalEncounter>;

export type PatientMedicalEncounter = Omit<DoctorMedicalEncounter, 'idEncounter'>;
export type PatientMedicalRecordPage = PaginatedResponse<PatientMedicalEncounter>;
