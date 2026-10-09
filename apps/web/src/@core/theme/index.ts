// Next Imports
import { Manrope } from 'next/font/google';

// MUI Imports
import type { Theme } from '@mui/material/styles';

// Type Imports
import type { SystemMode } from '@core/types';

// Theme Options Imports
import overrides from './overrides';
import colorSchemes from './colorSchemes';
import spacing from './spacing';
import shadows from './shadows';
import customShadows from './customShadows';
import typography from './typography';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const theme = (mode: SystemMode, direction: Theme['direction']): Theme => {
  return {
    direction,
    components: overrides(),
    colorSchemes: colorSchemes(),
    ...spacing,
    shape: {
      borderRadius: 6,
      customBorderRadius: {
        xs: 2,
        sm: 4,
        md: 6,
        lg: 8,
        xl: 10,
      },
    },
    shadows: shadows(mode),
    typography: typography(manrope.style.fontFamily),
    customShadows: customShadows(mode),
    mainColorChannels: {
      light: '30 41 59',
      dark: '226 232 240',
      lightShadow: '15 23 42',
      darkShadow: '2 6 23',
    },
  } as Theme;
};

export default theme;
