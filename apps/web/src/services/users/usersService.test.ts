import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usersService } from './usersService';
import { rolesService } from '../roles/rolesService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('User administration with the shared HTTP client', () => {
  it('preserves pagination metadata and centralizes list, detail and role requests', async () => {
    const page = { data: [{ idUser: 1 }], meta: { page: 2, limit: 10, total: 12, totalPages: 2 } };
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: page })
      .mockResolvedValueOnce({ data: { data: page.data[0] } })
      .mockResolvedValueOnce({ data: { data: [{ name: 'STAFF' }] } });
    const query = { page: 2, limit: 10, status: 'all' as const, search: 'Ana' };

    expect(await usersService.list(query)).toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/users', { params: query });
    expect(await usersService.get(1)).toEqual(page.data[0]);
    expect(apiClient.get).toHaveBeenCalledWith('/users/id/1');
    expect(await rolesService.list()).toEqual([{ name: 'STAFF' }]);
    expect(apiClient.get).toHaveBeenCalledWith('/roles');
  });

  it('uses the existing administrative endpoints and propagates API failures', async () => {
    const user = {
      username: 'ana',
      name: 'Ana',
      lastname: 'Pérez',
      email: 'ana@example.com',
      ci: '123',
      password: 'secret',
      roleNames: ['STAFF'],
    };

    await usersService.create(user);
    await usersService.update(1, { name: 'Ana' });
    await usersService.replaceRoles(1, ['STAFF']);
    await usersService.replaceRoles(1, ['DOCTOR', 'STAFF']);
    await usersService.deactivate(1);
    await usersService.reactivate(1);
    expect(apiClient.post).toHaveBeenCalledWith('/users', user);
    expect(apiClient.patch).toHaveBeenCalledWith('/users/1', { name: 'Ana' });
    expect(apiClient.put).toHaveBeenCalledWith('/users/assign-roles/1', { roleNames: ['STAFF'] });
    expect(apiClient.put).toHaveBeenCalledWith('/users/assign-roles/1', { roleNames: ['DOCTOR', 'STAFF'] });
    expect(apiClient.delete).toHaveBeenCalledWith('/users/1');
    expect(apiClient.patch).toHaveBeenCalledWith('/users/reactivate/1');
    const error = new Error('API denied');

    vi.mocked(apiClient.patch).mockRejectedValueOnce(error);
    await expect(usersService.update(1, { name: 'Ana' })).rejects.toBe(error);
  });
});
