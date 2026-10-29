import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/services/http/axiosClient';
import { medicalRecordsService } from './medicalRecordsService';

vi.mock('@/services/http/axiosClient', () => ({ apiClient: { get: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('Medical record API client', () => {
  it('sends only appointment context and shared pagination, preserving the response metadata', async () => {
    const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await medicalRecordsService.byAppointment(9, { page: 2, limit: 5 })).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith('/medical-records/by-appointment/9', {
      params: { page: 2, limit: 5 },
    });
  });
  it('propagates access failures for the view to clear any prior content', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('denied'));
    await expect(medicalRecordsService.byAppointment(9, { page: 1, limit: 10 })).rejects.toThrow('denied');
  });
});
