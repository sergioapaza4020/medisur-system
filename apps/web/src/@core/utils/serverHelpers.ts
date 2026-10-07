import 'server-only';

// Next Imports
import { cookies } from 'next/headers';

// Type Imports
import type { Settings } from '@core/contexts/settingsContext';
import type { SystemMode } from '@core/types';

// Config Imports
import themeConfig from '@configs/themeConfig';

export const getSettingsFromCookie = async (): Promise<Settings> => {
  const cookieStore = await cookies();

  const cookieName = themeConfig.settingsCookieName;

  return JSON.parse(cookieStore.get(cookieName)?.value || '{}');
};

export const getMode = async () => {
  const settingsCookie = await getSettingsFromCookie();

  // Get mode from cookie or fallback to theme config
  const _mode = settingsCookie.mode || themeConfig.mode;

  return _mode;
};

export const getSystemMode = async (): Promise<SystemMode> => {
  const mode = await getMode();

  return mode;
};

export const getServerMode = async () => {
  const mode = await getMode();

  return mode;
};
