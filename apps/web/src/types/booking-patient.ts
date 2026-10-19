import type { PaginationQuery, PaginatedResponse } from './pagination';

export interface BookingPatient {
  idUser: number;
  name: string;
  lastname: string;
  ci: string;
}
export interface PatientSelectionQuery extends PaginationQuery {
  search: string;
}
export type BookingPatientsPage = PaginatedResponse<BookingPatient>;
