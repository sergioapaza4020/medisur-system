import { describe, expect, it, vi } from 'vitest';

import { appointmentsService } from './appointmentsService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({ apiClient: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } }));
describe('Appointment transport', () => {
  it('posts only the selected schedule and its version, leaving identity and state to the server', async () => {
    const appointment = { idAppointment: 8, status: 'RESERVED' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: appointment } });
    expect(
      await appointmentsService.create({
        idSchedule: 9,
        version: 3,
        idDoctor: 2,
        idSpecialty: 1,
        date: '2099-11-02',
        startTime: '09:00',
        endTime: '10:00',
        timeZone: 'America/La_Paz',
      }),
    ).toEqual(appointment);
    expect(apiClient.post).toHaveBeenCalledWith('/appointments', { idSchedule: 9, expectedVersion: 3 });
  });
  it('preserves the common pagination envelope and sends list filters without patient identity', async () => {
    const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
    const query = { page: 2, limit: 5, period: 'past' as const, date: '2026-01-01', status: 'RESERVED' as const };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await appointmentsService.mine(query)).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/appointments/mine', { params: query });
  });
  it('uses bounded patient selection and sends only target, schedule and version for reception', async () => {
    const query = { page: 2, limit: 5, search: 'Ana' };
    const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await appointmentsService.patients(query)).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/appointments/patients', { params: query });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { idAppointment: 9 } } });
    await appointmentsService.createForPatient(
      {
        idSchedule: 3,
        version: 2,
        idDoctor: 6,
        idSpecialty: 8,
        date: '2099-01-01',
        startTime: '09:00',
        endTime: '10:00',
        timeZone: 'America/La_Paz',
      },
      7,
    );
    expect(apiClient.post).toHaveBeenCalledWith('/appointments/for-patient', {
      idSchedule: 3,
      expectedVersion: 2,
      idPatient: 7,
    });
  });
  it('queries the own-doctor agenda with filters and preserves common pagination metadata', async () => {
    const query = { page: 2, limit: 5, from: '2026-11-01', to: '2026-11-30', status: 'CANCELLED' as const };
    const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await appointmentsService.agenda(query)).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/appointments/agenda', { params: query });
  });
  it('cancels only by appointment identifier and sends no patient or audit fields', async () => {
    const result = { idAppointment: 9, status: 'CANCELLED', cancelledAt: '2026-10-19T12:00:00Z' };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: result } });
    expect(await appointmentsService.cancelMine(9)).toEqual(result);
    expect(apiClient.patch).toHaveBeenCalledWith('/appointments/9/cancel');
  });
});

it('sends only the reason to the doctor cancellation endpoint', async () => {
  const result = { idAppointment: 9, status: 'CANCELLED', cancelledAt: '2026-10-19T12:00:00Z' };
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: result } });
  expect(await appointmentsService.cancelAsDoctor(9, 'Urgencia')).toEqual(result);
  expect(apiClient.patch).toHaveBeenCalledWith('/appointments/9/cancel-as-doctor', { reason: 'Urgencia' });
});

it('uses scoped rescheduling endpoints and the existing pagination envelope', async () => {
  const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
  const query = { page: 2, limit: 5, date: '2099-11-03' };
  vi.mocked(apiClient.get).mockResolvedValue({ data: page });
  expect(await appointmentsService.reschedulingAvailability(9, query)).toEqual(page);
  expect(apiClient.get).toHaveBeenCalledWith('/appointments/9/rescheduling-availability', { params: query });
  expect(await appointmentsService.patientProposals(9, { page: 2, limit: 5 })).toEqual(page);
  expect(apiClient.get).toHaveBeenCalledWith('/appointments/9/rescheduling-proposals', {
    params: { page: 2, limit: 5 },
  });
  vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { idProposal: 3, status: 'PENDING' } } });
  expect(
    await appointmentsService.proposeRescheduling(9, {
      idSchedule: 4,
      version: 2,
      idDoctor: 99,
      idSpecialty: 88,
      date: '2099-11-03',
      startTime: '11:00',
      endTime: '12:00',
      timeZone: 'America/La_Paz',
    }),
  ).toMatchObject({ idProposal: 3 });
  expect(apiClient.post).toHaveBeenCalledWith('/appointments/9/rescheduling-proposals', {
    idSchedule: 4,
    expectedVersion: 2,
  });
});

it('responds with only the decision and reads scoped doctor history', async () => {
  const result = { idProposal: 3, status: 'ACCEPTED', resultingAppointmentId: 20 };
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: result } });
  expect(await appointmentsService.respondRescheduling(3, 'ACCEPTED')).toEqual(result);
  expect(apiClient.patch).toHaveBeenCalledWith('/appointments/rescheduling-proposals/3/response', {
    status: 'ACCEPTED',
  });
  await appointmentsService.respondRescheduling(3, 'REJECTED');
  expect(apiClient.patch).toHaveBeenLastCalledWith('/appointments/rescheduling-proposals/3/response', {
    status: 'REJECTED',
  });
  const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
  vi.mocked(apiClient.get).mockResolvedValue({ data: page });
  expect(await appointmentsService.doctorProposals(9, { page: 2, limit: 5 })).toEqual(page);
  expect(apiClient.get).toHaveBeenCalledWith('/appointments/9/rescheduling-proposals/doctor', {
    params: { page: 2, limit: 5 },
  });
});
