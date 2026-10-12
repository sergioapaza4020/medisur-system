import type { PaginatedResponse, PaginationQuery } from './pagination';

export interface Specialty {
  idSpecialty: number;
  name: string;
  isActive: boolean;
}

export interface SpecialtiesQuery extends PaginationQuery {
  status: 'active' | 'inactive' | 'all';
  search?: string;
}

export type SpecialtiesPage = PaginatedResponse<Specialty>;
export interface SpecialtyWrite {
  name: string;
}
