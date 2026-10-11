import type { PaginatedResponse, PaginationQuery } from './pagination';

export interface AdministrativeRole {
  idRole: number;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  permissionCount: number;
}

export interface RolesQuery extends PaginationQuery {
  status: 'active' | 'inactive' | 'all';
  search?: string;
}

export type RolesPage = PaginatedResponse<AdministrativeRole>;
export interface CreateRole {
  name: string;
  description: string;
}
export type UpdateRole = Pick<CreateRole, 'description'>;
