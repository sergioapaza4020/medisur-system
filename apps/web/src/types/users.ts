import type { ApiResponse } from './auth';

export interface AdministrativeUser {
  idUser: number;
  username: string;
  email: string;
  name: string;
  lastname: string;
  ci: string;
  isActive: boolean;
  roles: { idRole: number; name: string; isActive: boolean }[];
}

export type UserFields = Pick<AdministrativeUser, 'username' | 'email' | 'name' | 'lastname' | 'ci'>;
export type CreateUser = UserFields & { password: string; roleNames: string[] };
export type UpdateUser = Partial<UserFields>;
export interface UsersQuery {
  page: number;
  limit: number;
  status: 'active' | 'inactive' | 'all';
  search?: string;
}
export interface UsersPage extends ApiResponse<AdministrativeUser[]> {
  meta: { page: number; limit: number; total: number; totalPages: number };
}
