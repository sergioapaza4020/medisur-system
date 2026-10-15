import type { SxProps, Theme } from '@mui/material/styles';

export const sectionSx = { py: { xs: 10, md: 16 }, scrollMarginTop: 24 };

export const darkSurfaceSx = {
  bgcolor: (theme: Theme) => theme.colorSchemes?.dark?.palette.background.paper ?? theme.palette.primary.dark,
  color: 'common.white',
} satisfies SxProps<Theme>;

export const interactionSx = {
  '& a:focus-visible, & button:focus-visible': {
    outline: '3px solid',
    outlineColor: 'primary.light',
    outlineOffset: 4,
  },
  '& .MuiButton-root': { minHeight: 44 },
  '& .MuiIconButton-root': { minWidth: 44, minHeight: 44 },
  '@media (prefers-reduced-motion: reduce)': {
    '& *, & *::before, & *::after': {
      animation: 'none !important',
      transition: 'none !important',
      scrollBehavior: 'auto !important',
    },
  },
} satisfies SxProps<Theme>;
