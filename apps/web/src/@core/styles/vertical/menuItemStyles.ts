import type { Theme } from '@mui/material/styles';

import type { MenuItemStyles } from '@menu/types';
import { menuClasses } from '@menu/utils/menuClasses';

const menuItemStyles = (theme: Theme): MenuItemStyles => ({
  root: {
    marginBlockStart: theme.spacing(1),
    [`&.${menuClasses.subMenuRoot}.${menuClasses.open} > .${menuClasses.button}`]: {
      backgroundColor: 'var(--mui-palette-primary-lighterOpacity)',
    },
    [`& > .${menuClasses.button}.${menuClasses.active}`]: {
      color: 'var(--mui-palette-primary-main)',
      background: 'var(--mui-palette-primary-lightOpacity)',
      [`& .${menuClasses.icon}`]: { color: 'inherit' },
      '&::before': {
        content: '""',
        position: 'absolute',
        insetInlineStart: 0,
        insetBlock: theme.spacing(2),
        width: 3,
        borderRadius: 3,
        backgroundColor: 'var(--mui-palette-primary-main)',
      },
    },
    [`&.${menuClasses.disabled} > .${menuClasses.button}`]: {
      color: 'var(--mui-palette-text-disabled)',
      [`& .${menuClasses.icon}`]: { color: 'inherit' },
    },
  },
  button: ({ level }) => ({
    ['&.' + menuClasses.active]: {
      color: 'var(--mui-palette-primary-main)',
      backgroundColor: 'var(--mui-palette-primary-lightOpacity)',
    },
    position: 'relative',
    minHeight: 46,
    paddingBlock: theme.spacing(2),
    paddingInlineStart: theme.spacing(3 + level * 2),
    paddingInlineEnd: theme.spacing(3),
    borderRadius: 10,
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': { backgroundColor: 'var(--mui-palette-primary-lighterOpacity)' },
    '&:focus-visible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: -2 },
  }),
  icon: ({ level }) => ({
    fontSize: level === 0 ? '1.375rem' : '0.625rem',
    color: 'inherit',
    marginInlineEnd: theme.spacing(level === 0 ? 3 : 3.5),
    '& > i, & > svg': { fontSize: 'inherit' },
  }),
  label: { fontSize: '0.875rem', fontWeight: 500 },
  prefix: { marginInlineEnd: theme.spacing(2) },
  suffix: { marginInlineStart: theme.spacing(2) },
  subMenuExpandIcon: {
    fontSize: '1.125rem',
    color: 'var(--mui-palette-text-secondary)',
    marginInlineStart: theme.spacing(2),
    '& i, & svg': { fontSize: 'inherit' },
  },
  subMenuContent: { backgroundColor: 'transparent' },
});

export default menuItemStyles;
