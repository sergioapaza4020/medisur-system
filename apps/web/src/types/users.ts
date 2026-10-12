import type { PaginatedResponse, PaginationQuery } from './pagination';

export type PatientRegistrationMatch = Pick<
  AdministrativeUser,
  'idUser' | 'email' | 'name' | 'lastname' | 'ci' | 'isActive'
> & { isPatient: boolean };
export type PatientRegistrationMatches = PaginatedResponse<PatientRegistrationMatch>;

export interface AdministrativeUser {
  idUser: number;
  email: string;
  name: string;
  lastname: string;
  ci: string;
  isActive: boolean;
  roles: { idRole: number; name: string; isActive: boolean }[];
}

export type UserFields = Pick<AdministrativeUser, 'email' | 'name' | 'lastname' | 'ci'>;
export type CreateUser = UserFields & { password: string; roleNames: string[] };
export type UpdateUser = Partial<UserFields>;
export interface UsersQuery extends PaginationQuery {
  status: 'active' | 'inactive' | 'all';
  search?: string;
}
export type UsersPage = PaginatedResponse<AdministrativeUser>;
