import { beforeEach, describe, expect, it, vi } from 'vitest';

import { doctorsService } from './doctorsService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('Doctor HTTP client', () => {
  it('keeps pagination and filters for doctor listings and registration searches', async () => {
    const result = { data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: result });
    const query = { page: 2, limit: 10, status: 'all' as const, search: 'ana' };
    expect(await doctorsService.list(query)).toEqual(result);
    expect(await doctorsService.searchUsers(query)).toEqual(result);
    expect(apiClient.get).toHaveBeenCalledWith('/doctors', { params: query });
    expect(apiClient.get).toHaveBeenCalledWith('/doctors/registration-users', { params: query });
  });
  it('registers the existing user and uses logical state endpoints', async () => {
    const doctor = { idDoctor: 1 };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: doctor } });
    const dto = { idUser: 4, isActive: true, specialtyIds: [1, 2] };
    expect(await doctorsService.create(dto)).toEqual(doctor);
    expect(apiClient.post).toHaveBeenCalledWith('/doctors', dto);
    await doctorsService.deactivate(1);
    await doctorsService.reactivate(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/doctors/1');
    expect(apiClient.patch).toHaveBeenCalledWith('/doctors/reactivate/1');
  });
  it('propagates API errors to shared error handling', async () => {
    const failure = new Error('Duplicado');
    vi.mocked(apiClient.post).mockRejectedValueOnce(failure);
    await expect(doctorsService.create({ idUser: 4, isActive: true, specialtyIds: [] })).rejects.toBe(failure);
  });
});
