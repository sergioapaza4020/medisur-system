import type { Theme } from '@mui/material/styles';

import { menuClasses, verticalNavClasses } from '@menu/utils/menuClasses';

const navigationCustomStyles = (theme: Theme) => ({
  color: 'var(--mui-palette-text-primary)',
  zIndex: 'var(--drawer-z-index) !important',
  [`& .${verticalNavClasses.bgColorContainer}`]: { backgroundColor: 'var(--mui-palette-background-paper)' },
  [`& .${verticalNavClasses.header}`]: {
    paddingBlock: theme.spacing(5),
    paddingInline: theme.spacing(5, 3),
    gap: theme.spacing(2),
    minHeight: 84,
  },
  [`& .${verticalNavClasses.container}`]: { borderColor: 'var(--mui-palette-divider)' },
  [`& .${menuClasses.root}`]: { paddingBlockEnd: theme.spacing(5), paddingInline: theme.spacing(3) },
  [`& .${verticalNavClasses.backdrop}`]: { backgroundColor: 'var(--backdrop-color)' },
  '& a:focus-visible, & button:focus-visible': {
    outline: '2px solid var(--mui-palette-primary-main)',
    outlineOffset: 2,
  },
  '& .ps__rail-y': { backgroundColor: 'transparent !important', width: 6 },
  '& .ps__thumb-y': { backgroundColor: 'var(--mui-palette-divider)', width: 4 },
});

export default navigationCustomStyles;
