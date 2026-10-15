'use client';

import NextLink from 'next/link';

import { Box, Button, Container, Stack, Typography } from '@mui/material';

import Logo from '@components/layout/shared/Logo';

export default function HeroSection() {
  return (
    <Container maxWidth='lg' component='section' aria-labelledby='landing-title' sx={{ py: { xs: 14, md: 24 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
          alignItems: 'center',
          gap: { xs: 12, md: 16 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id='landing-title'
            component='h1'
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2.5rem', sm: '3.25rem', lg: '4rem' },
              lineHeight: 1.12,
              letterSpacing: '-0.035em',
              mb: 6,
            }}
          >
            Centro médico de especialidades{' '}
            <Box component='span' sx={{ color: 'primary.main' }}>
              MEDISUR
            </Box>
          </Typography>
          <Typography
            sx={{ color: 'text.secondary', fontSize: { xs: '1rem', sm: '1.125rem' }, lineHeight: 1.8, maxWidth: 520 }}
          >
            Atención médica especializada más cerca de ti. Encuentra especialistas y gestiona tus citas de manera
            sencilla.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={4} sx={{ mt: 8 }}>
            <Button component={NextLink} href='/register' size='large' variant='contained'>
              Crear cuenta
            </Button>
            <Button component={NextLink} href='/login' size='large' variant='outlined'>
              Iniciar sesión
            </Button>
          </Stack>
        </Box>
        {/* Replace this decorative brand panel with an approved MEDISUR mockup when available. */}
        <Box
          aria-hidden='true'
          sx={{
            position: 'relative',
            minWidth: 0,
            aspectRatio: '1 / 1',
            maxWidth: 480,
            width: '100%',
            justifySelf: 'center',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            bgcolor: 'primary.main',
            p: { xs: 6, sm: 10 },
          }}
        >
          <Box
            sx={{
              width: '100%',
              minHeight: { xs: 180, sm: 260 },
              bgcolor: 'background.paper',
              borderRadius: 3,
              boxShadow: 6,
              border: 1,
              borderColor: 'divider',
              display: 'grid',
              placeItems: 'center',
              p: 6,
            }}
          >
            <Stack alignItems='center' gap={5}>
              <Logo logoSize={64} />
              <Box sx={{ width: 48, height: 4, borderRadius: 2, bgcolor: 'secondary.main' }} />
              <Typography align='center' color='text.secondary'>
                Centro médico de especialidades
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
