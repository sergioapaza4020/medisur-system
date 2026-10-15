export interface DoctorSelection {
  idDoctor: number;
  name: string;
  lastname: string;
}

export interface SpecialtySelection {
  idSpecialty: number;
  name: string;
}

export interface PublicDoctor extends DoctorSelection {
  specialties: SpecialtySelection[];
}
