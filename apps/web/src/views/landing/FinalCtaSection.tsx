'use client';

import NextLink from 'next/link';

import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha, darken } from '@mui/material/styles';

import { darkSurfaceSx, sectionSx } from './landingStyles';

export default function FinalCtaSection() {
  return (
    <Box
      component='section'
      aria-labelledby='cta-title'
      sx={[
        darkSurfaceSx,
        sectionSx,
        { position: 'relative', isolation: 'isolate', overflow: 'hidden' },
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: darken(theme.colorSchemes?.dark?.palette.primary.dark ?? theme.palette.primary.dark, 0.55),
          }),
      ]}
    >
      <Box
        aria-hidden='true'
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          '& > div': {
            position: 'absolute',
            aspectRatio: '1',
            borderRadius: '50%',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: (theme) => alpha(theme.palette.common.white, 0.04),
          },
        }}
      >
        <Box sx={{ width: { xs: 360, sm: 600, md: 760, lg: 880 } }} />
        <Box sx={{ width: { xs: 320, sm: 550, md: 700, lg: 820 } }} />
      </Box>
      <Container maxWidth='md' sx={{ position: 'relative', zIndex: 1 }}>
        <Stack alignItems='center' gap={6} sx={{ textAlign: 'center' }}>
          <Typography component='h2' variant='h3' id='cta-title' color='inherit' sx={{ maxWidth: 560 }}>
            Agenda tu atención médica de forma sencilla
          </Typography>
          <Typography color='inherit' sx={{ maxWidth: 520 }}>
            Crea tu cuenta de paciente. Las reservas en línea aún no están habilitadas.
          </Typography>
          <Button
            component={NextLink}
            href='/register'
            variant='contained'
            color='secondary'
            size='large'
            sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' } }}
          >
            Crear una cuenta
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
