import { ProposalStatus } from 'src/entities/appointments/rescheduling-proposal.entity';

export interface PatientReschedulingProposal {
  idProposal: number;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ProposalStatus;
  respondedAt: Date | null;
  resultingAppointmentId: number | null;
  timeZone: 'America/La_Paz';
}
