import type { PaginatedResponse, PaginationQuery } from './pagination';

export interface Permission {
  idPermission: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface PermissionsQuery extends PaginationQuery {
  status: 'active' | 'inactive' | 'all';
}

export type PermissionsPage = PaginatedResponse<Permission>;

export interface RolePermissions {
  idRole: number;
  name: string;
  isActive: boolean;
  permissions: Permission[];
}
