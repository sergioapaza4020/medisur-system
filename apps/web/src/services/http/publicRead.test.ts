import { afterEach, describe, expect, it, vi } from 'vitest';

import { doctorsService } from '../doctors/doctorsService';
import { specialtiesService } from '../specialties/specialtiesService';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Anonymous catalog reads', () => {
  it('reuses domain services with bounded requests, no credentials, no cache and a timeout', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    const page = { data: [], meta: { page: 1, limit: 8, total: 0, totalPages: 0 } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(page) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await specialtiesService.publicPage({ page: 1, limit: 8 })).toEqual(page);
    await doctorsService.publicPage({ page: 1, limit: 6 });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3001/api/specialties/public?page=1&limit=8',
      'http://localhost:3001/api/doctors/public?page=1&limit=6',
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({ credentials: 'omit', cache: 'no-store', signal: expect.any(AbortSignal) });
      expect(options.headers).toBeUndefined();
    }
  });

  it('rejects unsuccessful responses without refreshing a session or redirecting', async () => {
    const json = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json }));
    await expect(doctorsService.publicPage({ page: 1, limit: 6 })).rejects.toThrow('Public catalog unavailable');
    expect(json).not.toHaveBeenCalled();
  });
});
