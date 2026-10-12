import { beforeEach, describe, expect, it, vi } from 'vitest';

import { specialtiesService } from './specialtiesService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('Specialties using the existing HTTP client', () => {
  it('preserves shared pagination and active catalog filters', async () => {
    const result = {
      data: [{ idSpecialty: 1, name: 'Cardiología', isActive: true }],
      meta: { page: 2, limit: 10, total: 12, totalPages: 2 },
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: result });
    const query = { page: 2, limit: 10, status: 'active' as const, search: 'Cardio' };
    expect(await specialtiesService.listPage(query)).toEqual(result);
    expect(apiClient.get).toHaveBeenCalledWith('/specialties', { params: query });
  });

  it('creates, edits and uses logical status endpoints', async () => {
    await specialtiesService.create({ name: 'Cardiología' });
    await specialtiesService.update(1, { name: 'Medicina interna' });
    await specialtiesService.deactivate(1);
    await specialtiesService.reactivate(1);
    expect(apiClient.post).toHaveBeenCalledWith('/specialties', { name: 'Cardiología' });
    expect(apiClient.patch).toHaveBeenCalledWith('/specialties/1', { name: 'Medicina interna' });
    expect(apiClient.delete).toHaveBeenCalledWith('/specialties/1');
    expect(apiClient.patch).toHaveBeenCalledWith('/specialties/reactivate/1');
  });

  it('propagates failures to shared error handling', async () => {
    const error = new Error('La especialidad ya existe');
    vi.mocked(apiClient.post).mockRejectedValueOnce(error);
    await expect(specialtiesService.create({ name: 'Cardiología' })).rejects.toBe(error);
  });
});
