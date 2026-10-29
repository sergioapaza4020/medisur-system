export interface DoctorMedicalEncounter {
  idEncounter: number;
  occurredAt: Date;
  summary: string;
  doctor: { name: string; lastname: string };
  specialty: { name: string };
}
