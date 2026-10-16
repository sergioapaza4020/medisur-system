import { beforeEach, describe, expect, it, vi } from 'vitest';

import { myAccountService } from './myAccountService';
import { apiClient } from '../http/axiosClient';
import { clearTokens } from '@/utils/http/authCookies';

vi.mock('../http/axiosClient', () => ({ apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/utils/http/authCookies', () => ({ clearTokens: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe('own account HTTP service', () => {
  it('uploads one multipart file without an ID, URL or key and lets the browser set its boundary', async () => {
    const result = { avatarUrl: 'https://storage.example/photo.png', cleanupPending: false };
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: result } });
    expect(await myAccountService.uploadAvatar(file)).toEqual(result);
    const [path, form, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(path).toBe('/users/me/avatar');
    expect([...(form as FormData).keys()]).toEqual(['avatar']);
    expect((form as FormData).get('avatar')).toBe(file);
    expect(config?.headers?.['Content-Type']).toBeUndefined();
  });

  it('removes only the current avatar', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { data: { avatarUrl: null, cleanupPending: false } } });
    expect(await myAccountService.deleteAvatar()).toEqual({ avatarUrl: null, cleanupPending: false });
    expect(apiClient.delete).toHaveBeenCalledWith('/users/me/avatar');
  });
  it('loads the authenticated account without receiving an ID', async () => {
    const account = { name: 'Ana', lastname: 'Perez', ci: '123', email: 'ana@example.com' };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: account } });
    expect(await myAccountService.get()).toEqual(account);
    expect(apiClient.get).toHaveBeenCalledWith('/users/me');
  });

  it('sends only allowed partial fields and leaves normalization to the backend', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { data: { email: 'ana@example.com' } } });
    await myAccountService.update({ email: ' ANA@Example.com ', idUser: 2, roles: ['SUPERADMIN'] } as never);
    expect(apiClient.patch).toHaveBeenCalledWith('/users/me', {
      email: ' ANA@Example.com ',
      name: undefined,
      lastname: undefined,
      ci: undefined,
    });
  });

  it('sends current and new passwords and clears authentication only on success', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('incorrect password'));
    await expect(myAccountService.changePassword('old', 'new')).rejects.toThrow();
    expect(clearTokens).not.toHaveBeenCalled();
    await myAccountService.changePassword('old', 'new');
    expect(apiClient.post).toHaveBeenLastCalledWith('/users/me/password', { currentPassword: 'old', password: 'new' });
    expect(clearTokens).toHaveBeenCalledOnce();
  });

  it('deactivates without a user ID and clears cookies and auth state after success', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('last administrator'));
    await expect(myAccountService.deactivate()).rejects.toThrow();
    expect(clearTokens).not.toHaveBeenCalled();
    await myAccountService.deactivate();
    expect(apiClient.post).toHaveBeenLastCalledWith('/users/me/deactivate');
    expect(clearTokens).toHaveBeenCalledOnce();
  });
});
