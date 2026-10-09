import Cookies from 'js-cookie';

export const AUTH_CLEARED_EVENT = 'medisur:auth-cleared';
export const getAccessToken = () => Cookies.get('accessToken');
export const getRefreshToken = () => Cookies.get('refreshToken');

const cookieOptions = {
  path: '/',
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};

export const setAccessToken = (accessToken: string) => Cookies.set('accessToken', accessToken, cookieOptions);

export const setRefreshToken = (refreshToken: string, remember = false) =>
  Cookies.set('refreshToken', refreshToken, { ...cookieOptions, ...(remember ? { expires: 7 } : {}) });

export const saveTokens = (accessToken: string, refreshToken: string, remember = false) => {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken, remember);
};

export const clearTokens = () => {
  Cookies.remove('accessToken', { path: '/' });
  Cookies.remove('refreshToken', { path: '/' });

  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
};
