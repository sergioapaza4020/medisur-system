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
