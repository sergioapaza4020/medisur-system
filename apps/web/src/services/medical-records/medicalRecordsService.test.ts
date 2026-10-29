import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/services/http/axiosClient';
import { medicalRecordsService } from './medicalRecordsService';

vi.mock('@/services/http/axiosClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('Medical record API client', () => {
  it('uses separate management and own-beneficiary routes with shared pagination', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await medicalRecordsService.grants({ page: 2, limit: 5 }, 'manage');
    expect(apiClient.get).toHaveBeenLastCalledWith('/medical-records/extraordinary-access', {
      params: { page: 2, limit: 5 },
    });
    await medicalRecordsService.grants({ page: 1, limit: 10 }, 'mine');
    expect(apiClient.get).toHaveBeenLastCalledWith('/medical-records/extraordinary-access/mine', {
      params: { page: 1, limit: 10 },
    });
  });
  it('sends explicit concession data and revokes by grant and reason without a client actor', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { idGrant: 9 } } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { idGrant: 9 } } });
    const input = {
      idPatient: 2,
      idBeneficiary: 3,
      type: 'EMERGENCY' as const,
      reason: 'Situación de emergencia',
      expiresAt: '2026-10-29T16:00:00Z',
    };
    await medicalRecordsService.grant(input);
    expect(apiClient.post).toHaveBeenCalledWith('/medical-records/extraordinary-access', input);
    await medicalRecordsService.revoke(9, 'Autorización retirada');
    expect(apiClient.patch).toHaveBeenCalledWith('/medical-records/extraordinary-access/9/revoke', {
      reason: 'Autorización retirada',
    });
  });
  it('reads using only the grant context and uses minimal person searches', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await medicalRecordsService.byExtraordinaryGrant(9, { page: 1, limit: 10 });
    expect(apiClient.get).toHaveBeenLastCalledWith('/medical-records/by-extraordinary-grant/9', {
      params: { page: 1, limit: 10 },
    });
    await medicalRecordsService.people('patients', { search: 'Luis', page: 1, limit: 10 });
    expect(apiClient.get).toHaveBeenLastCalledWith('/medical-records/extraordinary-access/patients', {
      params: { search: 'Luis', page: 1, limit: 10 },
    });
    await medicalRecordsService.people('beneficiaries', { search: 'Ana', page: 1, limit: 10 });
    expect(apiClient.get).toHaveBeenLastCalledWith('/medical-records/extraordinary-access/beneficiaries', {
      params: { search: 'Ana', page: 1, limit: 10 },
    });
  });
  it('requests own history without sending a patient or account identifier', async () => {
    const page = { data: [], meta: { page: 2, limit: 5, total: 0, totalPages: 0 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: page });
    expect(await medicalRecordsService.mine({ page: 2, limit: 5 })).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith('/medical-records/mine', { params: { page: 2, limit: 5 } });
  });
  it('propagates own-history access errors', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('denied'));
    await expect(medicalRecordsService.mine({ page: 1, limit: 10 })).rejects.toThrow('denied');
  });
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
