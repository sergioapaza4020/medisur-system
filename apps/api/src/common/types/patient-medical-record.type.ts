import type { DoctorMedicalEncounter } from './doctor-medical-record.type';

export type PatientMedicalEncounter = Omit<DoctorMedicalEncounter, 'idEncounter'>;
