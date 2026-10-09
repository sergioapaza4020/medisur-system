import type { Theme } from '@mui/material/styles';

import type { MenuProps } from '@menu/vertical-menu';
import { menuClasses } from '@menu/utils/menuClasses';

const menuSectionStyles = (theme: Theme): MenuProps['menuSectionStyles'] => ({
  root: {
    marginBlockStart: theme.spacing(5),
    [`& .${menuClasses.menuSectionContent}`]: {
      color: 'var(--mui-palette-text-secondary)',
      paddingInline: `${theme.spacing(3)} !important`,
      paddingBlock: `${theme.spacing(2)} !important`,
      '&:before, &:after': { display: 'none' },
    },
    [`& .${menuClasses.menuSectionLabel}`]: {
      flexGrow: 0,
      fontSize: '0.6875rem',
      fontWeight: 600,
      lineHeight: 1.6,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
  },
});

export default menuSectionStyles;
