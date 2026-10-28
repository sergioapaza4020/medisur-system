export interface CreateEncounter {
  idAppointment?: number;
  idPatient?: number;
  idSpecialty?: number;
  summary: string;
}

export interface EncounterReceipt {
  idEncounter: number;
  idPatient: number;
  idDoctor: number;
  idSpecialty: number;
  idAppointment: number | null;
  occurredAt: string;
}
