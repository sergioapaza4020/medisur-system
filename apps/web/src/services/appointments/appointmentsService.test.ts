import { describe, expect, it, vi } from 'vitest';

import { appointmentsService } from './appointmentsService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({ apiClient: { post: vi.fn() } }));
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
});
