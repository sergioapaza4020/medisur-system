'use client';

import NextLink from 'next/link';

import { Box, Container, Link, Stack, Typography } from '@mui/material';

import Logo from '@components/layout/shared/Logo';

import { landingNavigation } from './navigation';
import { darkSurfaceSx } from './landingStyles';

export default function LandingFooter() {
  return (
    <Box
      component='footer'
      sx={[
        darkSurfaceSx,
        { py: { xs: 10, md: 12 } },
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: theme.colorSchemes?.dark?.palette.background.default ?? theme.palette.background.default,
          }),
      ]}
    >
      <Container maxWidth='lg'>
        <Stack alignItems='center' gap={7}>
          <Link component={NextLink} href='/' aria-label='MEDISUR, inicio' color='inherit' underline='none'>
            <Logo color='inherit' logoSize={42} />
          </Link>
          <Stack
            component='nav'
            aria-label='Navegación del pie de página'
            direction={{ xs: 'column', sm: 'row' }}
            flexWrap='wrap'
            justifyContent='center'
            alignItems='center'
            gap={{ xs: 1, sm: 5 }}
          >
            {landingNavigation.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                color='inherit'
                underline='hover'
                sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
              >
                {label}
              </Link>
            ))}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems='center' gap={{ xs: 1, sm: 5 }}>
            <Link
              component={NextLink}
              href='/login'
              color='inherit'
              underline='hover'
              sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              Iniciar sesión
            </Link>
            <Link
              component={NextLink}
              href='/register'
              color='inherit'
              underline='hover'
              sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              Crear cuenta
            </Link>
          </Stack>
          <Typography variant='body2' color='inherit' align='center'>
            © {new Date().getFullYear()} MEDISUR. Todos los derechos reservados.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
