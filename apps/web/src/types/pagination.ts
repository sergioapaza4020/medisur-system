import type { ApiResponse } from './auth';

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginationMeta extends PaginationQuery {
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}
