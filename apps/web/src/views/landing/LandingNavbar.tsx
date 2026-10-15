'use client';

import { useState } from 'react';

import NextLink from 'next/link';

import { Box, Button, Container, Drawer, IconButton, Link, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

import Logo from '@components/layout/shared/Logo';
import ModeDropdown from '@components/layout/shared/ModeDropdown';

import { landingNavigation } from './navigation';
import { interactionSx } from './landingStyles';

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));

  // Release the modal and its focus trap when a viewport with an open menu becomes desktop.
  if (desktop && open) setOpen(false);

  return (
    <Box component='header' sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Container maxWidth='lg'>
        <Stack direction='row' alignItems='center' justifyContent='space-between' gap={3} sx={{ minHeight: 88 }}>
          <Link component={NextLink} href='/' aria-label='MEDISUR, inicio' underline='none'>
            <Logo logoSize={42} />
          </Link>
          <Stack
            component='nav'
            aria-label='Navegación principal'
            direction='row'
            gap={4}
            sx={{ display: { xs: 'none', lg: 'flex' } }}
          >
            {landingNavigation.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                color='text.primary'
                underline='hover'
                variant='body2'
                sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
              >
                {label}
              </Link>
            ))}
          </Stack>
          <Stack direction='row' alignItems='center' gap={2}>
            <ModeDropdown />
            <Button component={NextLink} href='/login' sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              Iniciar sesión
            </Button>
            <Button
              component={NextLink}
              href='/register'
              variant='contained'
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Crear cuenta
            </Button>
            <IconButton
              aria-label='Abrir menú de navegación'
              aria-expanded={open}
              aria-controls={open ? 'landing-mobile-menu' : undefined}
              onClick={() => setOpen(true)}
              sx={{ display: { lg: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Container>
      <Drawer
        anchor='right'
        open={open}
        onClose={() => setOpen(false)}
        sx={{ display: { lg: 'none' } }}
        slotProps={{
          paper: { 'aria-labelledby': 'landing-menu-title', sx: { width: 340, maxWidth: '100%', ...interactionSx } },
        }}
      >
        <Box id='landing-mobile-menu' sx={{ p: 6 }}>
          <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 6 }}>
            <Typography component='p' variant='h6' id='landing-menu-title'>
              MEDISUR
            </Typography>
            <IconButton aria-label='Cerrar menú de navegación' onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Stack component='nav' aria-label='Navegación móvil' gap={2}>
            {landingNavigation.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                color='text.primary'
                underline='hover'
                onClick={() => setOpen(false)}
                sx={{ py: 2, minHeight: 44, display: 'flex', alignItems: 'center' }}
              >
                {label}
              </Link>
            ))}
            <Button component={NextLink} href='/login' variant='outlined' onClick={() => setOpen(false)} sx={{ mt: 4 }}>
              Iniciar sesión
            </Button>
            <Button component={NextLink} href='/register' variant='contained' onClick={() => setOpen(false)}>
              Crear cuenta
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
