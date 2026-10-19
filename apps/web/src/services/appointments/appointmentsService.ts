import type {
  ProposalAvailabilityPage,
  ProposalAvailabilityQuery,
  ProposalsPage,
  ReschedulingProposal,
} from '@/types/rescheduling-proposal';
import type { PaginationQuery } from '@/types/pagination';
import { apiClient } from '../http/axiosClient';
import type { AppointmentsPage, AppointmentsQuery } from '@/types/appointments';
import type { BookingPatientsPage, PatientSelectionQuery } from '@/types/booking-patient';
import type { DoctorAgendaPage, DoctorAgendaQuery } from '@/types/doctor-agenda';
import type { ApiResponse } from '@/types/auth';
import type { AvailabilityBlock } from '@/types/availability';

export type Appointment = Omit<AvailabilityBlock, 'version'> & {
  idAppointment: number;
  idPatient: number;
  status: 'RESERVED';
};

export const appointmentsService = {
  async respondRescheduling(idProposal: number, status: 'ACCEPTED' | 'REJECTED'): Promise<ReschedulingProposal> {
    return (
      await apiClient.patch<ApiResponse<ReschedulingProposal>>(
        `/appointments/rescheduling-proposals/${idProposal}/response`,
        { status },
      )
    ).data.data;
  },
  async doctorProposals(idAppointment: number, query: PaginationQuery): Promise<ProposalsPage> {
    return (
      await apiClient.get<ProposalsPage>(`/appointments/${idAppointment}/rescheduling-proposals/doctor`, {
        params: query,
      })
    ).data;
  },
  async proposeRescheduling(idAppointment: number, block: AvailabilityBlock): Promise<ReschedulingProposal> {
    return (
      await apiClient.post<ApiResponse<ReschedulingProposal>>(`/appointments/${idAppointment}/rescheduling-proposals`, {
        idSchedule: block.idSchedule,
        expectedVersion: block.version,
      })
    ).data.data;
  },
  async reschedulingAvailability(
    idAppointment: number,
    query: ProposalAvailabilityQuery,
  ): Promise<ProposalAvailabilityPage> {
    return (
      await apiClient.get<ProposalAvailabilityPage>(`/appointments/${idAppointment}/rescheduling-availability`, {
        params: query,
      })
    ).data;
  },
  async patientProposals(idAppointment: number, query: PaginationQuery): Promise<ProposalsPage> {
    return (
      await apiClient.get<ProposalsPage>(`/appointments/${idAppointment}/rescheduling-proposals`, { params: query })
    ).data;
  },
  async cancelMine(
    idAppointment: number,
  ): Promise<{ idAppointment: number; status: 'CANCELLED'; cancelledAt: string }> {
    return (
      await apiClient.patch<ApiResponse<{ idAppointment: number; status: 'CANCELLED'; cancelledAt: string }>>(
        `/appointments/${idAppointment}/cancel`,
      )
    ).data.data;
  },
  async cancelAsDoctor(idAppointment: number, reason: string) {
    return (
      await apiClient.patch<ApiResponse<{ idAppointment: number; status: 'CANCELLED'; cancelledAt: string }>>(
        `/appointments/${idAppointment}/cancel-as-doctor`,
        { reason },
      )
    ).data.data;
  },
  async agenda(query: DoctorAgendaQuery): Promise<DoctorAgendaPage> {
    return (await apiClient.get<DoctorAgendaPage>('/appointments/agenda', { params: query })).data;
  },
  async patients(query: PatientSelectionQuery): Promise<BookingPatientsPage> {
    return (await apiClient.get<BookingPatientsPage>('/appointments/patients', { params: query })).data;
  },
  async createForPatient(block: AvailabilityBlock, idPatient: number): Promise<Appointment> {
    return (
      await apiClient.post<ApiResponse<Appointment>>('/appointments/for-patient', {
        idSchedule: block.idSchedule,
        expectedVersion: block.version,
        idPatient,
      })
    ).data.data;
  },
  async mine(query: AppointmentsQuery): Promise<AppointmentsPage> {
    return (await apiClient.get<AppointmentsPage>('/appointments/mine', { params: query })).data;
  },
  async create(block: AvailabilityBlock): Promise<Appointment> {
    return (
      await apiClient.post<ApiResponse<Appointment>>('/appointments', {
        idSchedule: block.idSchedule,
        expectedVersion: block.version,
      })
    ).data.data;
  },
};
