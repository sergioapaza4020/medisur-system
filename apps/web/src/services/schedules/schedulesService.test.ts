import { beforeEach, describe, expect, it, vi } from 'vitest';

import { schedulesService } from './schedulesService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
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
  it('queries availability with doctor, optional specialty, date and shared pagination', async () => {
    const query = { idDoctor: 3, idSpecialty: 2, date: '2026-11-02', page: 2, limit: 5 };
    const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await schedulesService.availability(query)).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/schedules/availability', { params: query });
    const failure = new Error('Fecha inválida');
    vi.mocked(apiClient.get).mockRejectedValueOnce(failure);
    await expect(schedulesService.availability(query)).rejects.toBe(failure);
  });
  it('lists own schedules with shared pagination and replaces a versioned schedule', async () => {
    const query = { page: 2, limit: 5 };
    const page = { data: [], meta: { ...query, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await schedulesService.mine(query)).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/schedules/mine', { params: query });
    await schedulesService.specialties(query, true);
    expect(apiClient.get).toHaveBeenCalledWith('/schedules/editing-specialties', { params: query });
    const dto = {
      idSpecialty: 2,
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '10:00',
      isActive: false,
      expectedVersion: 1,
    };
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: { ...dto, version: 2 } } });
    expect(await schedulesService.update(9, dto)).toMatchObject({ version: 2 });
    expect(apiClient.put).toHaveBeenCalledWith('/schedules/9', dto);
  });
});
