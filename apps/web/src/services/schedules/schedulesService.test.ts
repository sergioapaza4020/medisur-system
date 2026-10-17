import { beforeEach, describe, expect, it, vi } from 'vitest';

import { schedulesService } from './schedulesService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('Schedule HTTP client', () => {
  it('reuses the pagination contract for own specialties', async () => {
    const query = { page: 2, limit: 5 };
    const result = { data: [], meta: { ...query, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: result });
    expect(await schedulesService.specialties(query)).toEqual(result);
    expect(apiClient.get).toHaveBeenCalledWith('/schedules/specialties', { params: query });
  });
  it('creates a schedule without accepting a doctor identity', async () => {
    const dto = { idSpecialty: 2, date: '2026-11-02', startTime: '09:00', endTime: '10:00' };
    const saved = { ...dto, idSchedule: 1, idDoctor: 3, isActive: true };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: saved } });
    expect(await schedulesService.create(dto)).toEqual(saved);
    expect(apiClient.post).toHaveBeenCalledWith('/schedules', dto);
  });
  it('preserves validation and permission errors for the form', async () => {
    const failure = new Error('El horario se solapa');
    vi.mocked(apiClient.post).mockRejectedValue(failure);
    await expect(
      schedulesService.create({ idSpecialty: 2, date: '2026-11-02', startTime: '09:00', endTime: '10:00' }),
    ).rejects.toBe(failure);
  });
});
