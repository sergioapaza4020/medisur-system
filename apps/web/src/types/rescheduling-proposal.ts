import type { PaginatedResponse, PaginationQuery } from './pagination';
import type { AvailabilityPage } from './availability';

export interface ReschedulingProposal {
  idProposal: number;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  timeZone: 'America/La_Paz';
}
export type ProposalsPage = PaginatedResponse<ReschedulingProposal>;
export type ProposalAvailabilityQuery = PaginationQuery & { date: string };
export type ProposalAvailabilityPage = AvailabilityPage;
export const proposalStatusLabels = { PENDING: 'Pendiente', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada' };
