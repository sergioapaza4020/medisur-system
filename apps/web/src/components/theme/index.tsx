'use client';

// React Imports
import { useMemo } from 'react';

// MUI Imports
import { deepmerge } from '@mui/utils';
import { ThemeProvider as MuiThemeProvider, extendTheme } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import CssBaseline from '@mui/material/CssBaseline';

import type {} from '@mui/material/themeCssVarsAugmentation';
import type {} from '@mui/lab/themeAugmentation';

// Type Imports
import type { ChildrenType, Direction } from '@core/types';

// Component Imports
import ModeChanger from './ModeChanger';

// Config Imports
import themeConfig from '@configs/themeConfig';
import primaryColorConfig from '@configs/primaryColorConfig';

// Hook Imports
import { useSettings } from '@core/hooks/useSettings';

// Core Theme Imports
import defaultCoreTheme from '@core/theme';

type Props = ChildrenType & {
  direction: Direction;
};

const ThemeProvider = (props: Props) => {
  const { children, direction } = props;

  const { settings } = useSettings();

  const theme = useMemo(() => {
    const primaryColor = primaryColorConfig[0];

    const newColorScheme = {
      colorSchemeSelector: 'class',

      colorSchemes: {
        light: {
          palette: {
            primary: {
              main: primaryColor.light.main,
              light: primaryColor.light.light,
              dark: primaryColor.light.dark,
              contrastText: '#FFFFFF',
            },
          },
        },

        dark: {
          palette: {
            primary: {
              main: primaryColor.dark.main,
              light: primaryColor.dark.light,
              dark: primaryColor.dark.dark,
              contrastText: '#FFFFFF',
            },
          },
        },
      },
    };

    const coreTheme = deepmerge(defaultCoreTheme(settings.mode || 'light', direction), newColorScheme);

    return extendTheme(coreTheme);
  }, [settings.mode, direction]);

  return (
    <AppRouterCacheProvider options={{ prepend: true }}>
      <MuiThemeProvider
        theme={theme}
        defaultMode={settings.mode}
        modeStorageKey={`${themeConfig.templateName.toLowerCase().split(' ').join('-')}-mui-template-mode`}
      >
        <ModeChanger />

        <CssBaseline />

        {children}
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  );
};

export default ThemeProvider;
