import { expect, it, vi } from 'vitest';

import { permissionsService } from './permissionsService';
import { apiClient } from '../http/axiosClient';

vi.mock('../http/axiosClient', () => ({ apiClient: { get: vi.fn() } }));

it('consumes the real paginated catalog through the shared client, preserving codes', async () => {
  const page = { data: [{ name: 'user.create' }], meta: { page: 2, limit: 10, total: 27, totalPages: 3 } };
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: page });
  const query = { page: 2, limit: 10, status: 'all' as const };
  expect(await permissionsService.listPage(query)).toEqual(page);
  expect(apiClient.get).toHaveBeenCalledWith('/permissions', { params: query });
});
