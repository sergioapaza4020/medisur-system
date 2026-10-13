import type { PaginatedResponse, PaginationQuery } from './pagination';
import type { UserFields } from './users';
import type { Specialty } from './specialties';

export interface DoctorAccount extends UserFields {
  idUser: number;
  isActive: boolean;
}
export interface Doctor {
  idDoctor: number;
  isActive: boolean;
  user: DoctorAccount;
  specialties: Specialty[];
}
export interface DoctorCreate {
  idUser: number;
  isActive: boolean;
  specialtyIds: number[];
}
export interface DoctorsQuery extends PaginationQuery {
  status: 'active' | 'inactive' | 'all';
  search?: string;
}
export type DoctorsPage = PaginatedResponse<Doctor>;
export type DoctorAccountsPage = PaginatedResponse<DoctorAccount>;

export interface DoctorSelection {
  idDoctor: number;
  name: string;
  lastname: string;
}
export type SpecialtySelection = Pick<Specialty, 'idSpecialty' | 'name'>;
export type DoctorSelectionPage = PaginatedResponse<DoctorSelection>;
export type SpecialtySelectionPage = PaginatedResponse<SpecialtySelection>;
