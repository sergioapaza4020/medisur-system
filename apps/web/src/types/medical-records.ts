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

export interface ExtraordinaryGrant {
  idGrant: number;
  patient: { idUser: number; name: string; lastname: string; ci: string };
  beneficiary: { idUser: number; name: string; lastname: string };
  type: 'AUTHORIZATION' | 'EMERGENCY';
  reason: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  state: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}
export interface CreateExtraordinaryGrant {
  idPatient: number;
  idBeneficiary: number;
  type: ExtraordinaryGrant['type'];
  reason: string;
  expiresAt: string;
}
export type ExtraordinaryGrantsPage = PaginatedResponse<ExtraordinaryGrant>;
