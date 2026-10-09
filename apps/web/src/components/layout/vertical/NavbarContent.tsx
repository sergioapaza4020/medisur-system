'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';

import NavToggle from './NavToggle';
import NavSearch from '@components/layout/shared/search';
import ModeDropdown from '@components/layout/shared/ModeDropdown';
import UserDropdown from '@components/layout/shared/UserDropdown';

import { verticalLayoutClasses } from '@layouts/utils/layoutClasses';

const NavbarContent = () => (
  <Box
    className={verticalLayoutClasses.navbarContent}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minWidth: 0,
      minHeight: 64,
      gap: { xs: 1, sm: 4 },
      '& .MuiIconButton-root': {
        width: 44,
        height: 44,
        borderRadius: 2.5,
        color: 'text.primary',
        '&:hover': { bgcolor: 'primary.lighterOpacity' },
        '&:focus-visible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 },
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 }, flex: 1, minWidth: 0 }}>
      <NavToggle />
      <NavSearch />
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 2 }, flexShrink: 0 }}>
      <ModeDropdown />
      <IconButton aria-label='Notificaciones'>
        <i aria-hidden='true' className='ri-notification-2-line' />
      </IconButton>
      <UserDropdown />
    </Box>
  </Box>
);

export default NavbarContent;
