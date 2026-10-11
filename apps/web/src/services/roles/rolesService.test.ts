import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rolesService } from './rolesService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('Roles using the existing HTTP client', () => {
  it('reads assignments and replaces multiple grants without sending role or catalog modifications', async () => {
    const role = { idRole: 1, name: 'SUPERADMIN', permissions: [{ name: 'user.create' }] };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: role } });
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { data: role } });
    expect(await rolesService.getPermissions(1)).toEqual(role);
    expect(await rolesService.replacePermissions(1, ['user.create'])).toEqual(role);
    expect(apiClient.get).toHaveBeenCalledWith('/roles/id/1');
    expect(apiClient.put).toHaveBeenCalledWith('/roles/assign-permissions/1', { permissionNames: ['user.create'] });
  });
  it('preserves shared pagination, filters and internal role codes', async () => {
    const result = {
      data: [{ name: 'SUPERADMIN', isSystem: true }],
      meta: { page: 2, limit: 10, total: 12, totalPages: 2 },
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: result });
    const query = { page: 2, limit: 10, status: 'all' as const, search: 'SUPERADMIN' };
    expect(await rolesService.listPage(query)).toEqual(result);
    expect(apiClient.get).toHaveBeenCalledWith('/roles', { params: query });
  });

  it('keeps the user role selector complete by consuming every bounded page', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: [{ idRole: 1, name: 'SUPERADMIN' }], meta: { totalPages: 2 } } })
      .mockResolvedValueOnce({ data: { data: [{ idRole: 101, name: 'RECEPTION' }], meta: { totalPages: 2 } } });
    expect(await rolesService.list()).toEqual([
      { idRole: 1, name: 'SUPERADMIN' },
      { idRole: 101, name: 'RECEPTION' },
    ]);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/roles', { params: { page: 1, limit: 100, status: 'all' } });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/roles', { params: { page: 2, limit: 100, status: 'all' } });
  });

  it('creates and updates only administrative fields and uses logical status endpoints', async () => {
    await rolesService.create({ name: 'RECEPTION', description: 'Recepción' });
    await rolesService.update(5, { description: 'Actualizada' });
    await rolesService.deactivate(5);
    await rolesService.reactivate(5);
    expect(apiClient.post).toHaveBeenCalledWith('/roles', { name: 'RECEPTION', description: 'Recepción' });
    expect(apiClient.patch).toHaveBeenCalledWith('/roles/5', { description: 'Actualizada' });
    expect(apiClient.delete).toHaveBeenCalledWith('/roles/5');
    expect(apiClient.patch).toHaveBeenCalledWith('/roles/reactivate/5');
    expect(JSON.stringify(vi.mocked(apiClient.post).mock.calls)).not.toContain('permissionNames');
  });

  it('propagates API failures without replacing the shared error handling', async () => {
    const error = new Error('Duplicado');
    vi.mocked(apiClient.post).mockRejectedValueOnce(error);
    await expect(rolesService.create({ name: 'RECEPTION', description: '' })).rejects.toBe(error);
  });
});
