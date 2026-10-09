'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Divider from '@mui/material/Divider';
import Fade from '@mui/material/Fade';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';

import { useAuth } from '@/components/auth/AuthGuard';

const UserDropdown = () => {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Local credentials are removed even if the API is unavailable.
    } finally {
      setOpen(false);
      router.replace('/login');
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  const closeMenu = () => {
    setOpen(false);
    anchorRef.current?.focus();
  };

  return (
    <>
      <ButtonBase
        ref={anchorRef}
        aria-label='Menú de usuario'
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={open ? 'user-menu' : undefined}
        onClick={(event) => {
          setAnchorEl(event.currentTarget);
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setAnchorEl(event.currentTarget);
            setOpen(true);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1,
          borderRadius: 2.5,
          '&:hover': { bgcolor: 'primary.lighterOpacity' },
          '&:focus-visible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 },
        }}
      >
        <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.lighterOpacity', color: 'primary.main' }}>
          <i aria-hidden='true' className='ri-user-line' />
        </Avatar>
        <Typography
          sx={{ display: { xs: 'none', md: 'block' }, fontWeight: 600, color: 'text.primary', fontSize: '0.875rem' }}
        >
          {user?.name || user?.username || 'Mi cuenta'}
        </Typography>
        <i aria-hidden='true' className={open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
      </ButtonBase>
      <Popper
        open={open}
        transition
        placement='bottom-end'
        anchorEl={anchorEl}
        modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.modal }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps}>
            <Paper
              sx={{
                width: 300,
                maxWidth: 'calc(100vw - 24px)',
                borderRadius: 3,
                border: '1px solid var(--mui-palette-primary-lightOpacity)',
                boxShadow: '0 12px 40px var(--mui-palette-primary-lightOpacity)',
                overflow: 'hidden',
              }}
            >
              <ClickAwayListener
                onClickAway={(event) => {
                  if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 5 }}>
                    <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.lighterOpacity', color: 'primary.main' }}>
                      <i aria-hidden='true' className='ri-user-line' />
                    </Avatar>
                    <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {user?.name || user?.username}
                    </Typography>
                  </Box>
                  <Divider sx={{ mx: 4 }} />
                  <MenuList
                    id='user-menu'
                    autoFocusItem={open}
                    aria-label='Opciones de usuario'
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' || event.key === 'Tab') {
                        event.preventDefault();
                        closeMenu();
                      }
                    }}
                    sx={{ p: 3 }}
                  >
                    <MenuItem
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      sx={{
                        gap: 3,
                        minHeight: 48,
                        borderRadius: 2,
                        color: 'error.main',
                        bgcolor: 'error.lighterOpacity',
                        '&:hover, &.Mui-focusVisible': { bgcolor: 'error.lightOpacity' },
                      }}
                    >
                      <i aria-hidden='true' className='ri-logout-box-r-line' />
                      <Typography sx={{ color: 'inherit', fontSize: '0.875rem', fontWeight: 500 }}>
                        {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                      </Typography>
                    </MenuItem>
                  </MenuList>
                </Box>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
};

export default UserDropdown;
