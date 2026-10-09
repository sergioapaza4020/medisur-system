import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authService } from './authService';
import { apiClient } from '../http/axiosClient';

import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/utils/http/authCookies';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const { cookies, setCookie } = vi.hoisted(() => ({ cookies: new Map<string, string>(), setCookie: vi.fn() }));

vi.mock('js-cookie', () => ({
  default: {
    get: (key: string) => cookies.get(key),
    set: (key: string, value: string, options: unknown) => {
      cookies.set(key, value);
      setCookie(key, value, options);
      return value;
    },
    remove: (key: string) => cookies.delete(key),
  },
}));

const user = {
  idUser: 1,
  idSession: 1,
  username: 'ana',
  name: 'Ana',
  email: 'ana@example.com',
  roles: ['STAFF'],
  permissions: ['role.get-all'],
};
const replace = vi.fn();
let calls: InternalAxiosRequestConfig[];

function success(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data: { status: true, statusCode: 200, data }, status: 200, statusText: 'OK', headers: {} };
}

function failure(config: InternalAxiosRequestConfig, status = 401, message = 'Credenciales inválidas'): never {
  throw new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
    config,
    status,
    statusText: 'Error',
    headers: {},
    data: { status: false, statusCode: status, message },
  });
}

beforeEach(() => {
  cookies.clear();
  vi.clearAllMocks();
  calls = [];
  vi.stubGlobal('window', { location: { pathname: '/dashboard', replace }, dispatchEvent: vi.fn() });
});

describe('MEDISUR authentication using the existing HTTP client', () => {
  it('submits credentials, saves tokens and restores the user and capabilities through /auth/me', async () => {
    apiClient.defaults.adapter = (config) => {
      calls.push(config);
      return Promise.resolve(
        success(
          config,
          config.url === '/auth/login'
            ? { accessToken: 'access', refreshToken: 'refresh', userSession: { idSession: 1 } }
            : user,
        ),
      );
    };
    await expect(authService.login({ username: 'ana', password: 'secret' }, true)).resolves.toEqual(user);
    expect(calls.map((c) => c.url)).toEqual(['/auth/login', '/auth/me']);
    expect(JSON.parse(calls[0].data as string)).toEqual({ username: 'ana', password: 'secret' });
    expect(calls[1].headers.Authorization).toBe('Bearer access');
    expect(getAccessToken()).toBe('access');
    expect(setCookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh',
      expect.objectContaining({ expires: 7, sameSite: 'strict', path: '/' }),
    );
  });

  it('rejects invalid login without attempting refresh or persisting credentials', async () => {
    apiClient.defaults.adapter = (config) => {
      calls.push(config);
      return Promise.reject(
        new AxiosError('Credentials rejected', 'ERR_BAD_REQUEST', config, undefined, {
          config,
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          data: { message: 'Credenciales inválidas' },
        }),
      );
    };
    const error = await authService.login({ username: 'ana', password: 'wrong' }).catch((error: unknown) => error);
    expect(getApiErrorMessage(error)).toBe('Credenciales inválidas');
    expect(calls.map((c) => c.url)).toEqual(['/auth/login']);
    expect(getAccessToken()).toBeUndefined();
    expect(getRefreshToken()).toBeUndefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it('refreshes a shared session once for concurrent 401 responses and retries with the renewed token', async () => {
    saveTokens('expired', 'refresh');
    apiClient.defaults.adapter = async (config) => {
      calls.push(config);
      if (config.url === '/auth/refresh-access-token') {
        await Promise.resolve();
        return success(config, { accessToken: 'renewed' });
      }
      if (config.headers.Authorization !== 'Bearer renewed') failure(config);
      return success(config, user);
    };
    await expect(Promise.all([authService.getCurrentUser(), authService.getCurrentUser()])).resolves.toEqual([
      user,
      user,
    ]);
    expect(calls.filter((c) => c.url === '/auth/refresh-access-token')).toHaveLength(1);
    expect(getAccessToken()).toBe('renewed');
  });

  it('clears authentication and redirects if refresh is rejected', async () => {
    saveTokens('expired', 'revoked');
    apiClient.defaults.adapter = (config) => {
      calls.push(config);
      return Promise.reject(
        new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
          config,
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          data: { message: 'Sesión no válida' },
        }),
      );
    };
    await expect(authService.getCurrentUser()).rejects.toBeInstanceOf(AxiosError);
    expect(calls.filter((c) => c.url === '/auth/refresh-access-token')).toHaveLength(1);
    expect(getAccessToken()).toBeUndefined();
    expect(getRefreshToken()).toBeUndefined();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('preserves authentication on a 403 and displays the API error', async () => {
    saveTokens('access', 'refresh');
    apiClient.defaults.adapter = async (config) => {
      calls.push(config);
      failure(config, 403, 'Insufficient permissions');
    };
    const error = await apiClient.get('/roles').catch((error: unknown) => error);
    expect(getApiErrorMessage(error)).toBe('Insufficient permissions');
    expect(calls).toHaveLength(1);
    expect(getAccessToken()).toBe('access');
    expect(replace).not.toHaveBeenCalled();
  });

  it('removes local credentials on logout even if the API cannot be reached', async () => {
    saveTokens('access', 'refresh');
    apiClient.defaults.adapter = (config) => {
      calls.push(config);
      return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
    };
    await expect(authService.logout()).rejects.toBeInstanceOf(AxiosError);
    expect(calls.map((c) => c.url)).toEqual(['/sessions/logout']);
    expect(getAccessToken()).toBeUndefined();
    expect(getRefreshToken()).toBeUndefined();
  });

  it('keeps the renewed session when the retried resource responds with 403', async () => {
    saveTokens('expired', 'refresh');
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh-access-token') return success(config, { accessToken: 'renewed' });
      failure(config, config.headers.Authorization === 'Bearer renewed' ? 403 : 401);
    };
    await expect(apiClient.get('/roles')).rejects.toMatchObject({ response: { status: 403 } });
    expect(getAccessToken()).toBe('renewed');
    expect(getRefreshToken()).toBe('refresh');
    expect(replace).not.toHaveBeenCalled();
  });

  it('stops retrying when a renewed access token is also rejected', async () => {
    saveTokens('expired', 'refresh');
    apiClient.defaults.adapter = async (config) => {
      calls.push(config);
      if (config.url === '/auth/refresh-access-token') return success(config, { accessToken: 'renewed' });
      failure(config);
    };
    await expect(authService.getCurrentUser()).rejects.toBeInstanceOf(AxiosError);
    expect(calls.filter((c) => c.url === '/auth/refresh-access-token')).toHaveLength(1);
    expect(getAccessToken()).toBeUndefined();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('cannot restore credentials with a refresh that completes after logout', async () => {
    saveTokens('expired', 'refresh');
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    apiClient.defaults.adapter = async (config) => {
      if (config.url !== '/auth/refresh-access-token') failure(config);
      clearTokens();
      await pending;
      return success(config, { accessToken: 'stale' });
    };
    const request = authService.getCurrentUser();
    release();
    await expect(request).rejects.toThrow('La sesión ha cambiado');
    expect(getAccessToken()).toBeUndefined();
  });

  it('keeps cookies tied to the browser session unless remember me is selected', () => {
    saveTokens('access', 'refresh');
    expect(setCookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh',
      expect.not.objectContaining({ expires: expect.anything() }),
    );
  });
});
