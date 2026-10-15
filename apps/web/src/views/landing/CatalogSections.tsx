'use client';

import { Alert, Box, Card, CardContent, CircularProgress, Container, Stack, Typography } from '@mui/material';
import MedicalServicesOutlined from '@mui/icons-material/MedicalServicesOutlined';
import { alpha } from '@mui/material/styles';

import CustomAvatar from '@core/components/mui/Avatar';
import type { PublicDoctor, SpecialtySelection } from '@/types/doctors';

import { sectionSx } from './landingStyles';

export type CatalogState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: T[] };

export function SpecialtiesSection({ state }: { state: CatalogState<SpecialtySelection> }) {
  return (
    <Container
      component='section'
      id='especialidades'
      aria-labelledby='especialidades-title'
      maxWidth='lg'
      sx={{ ...sectionSx, position: 'relative', isolation: 'isolate', overflow: 'visible' }}
    >
      <Box
        aria-hidden='true'
        sx={{
          position: 'absolute',
          height: { xs: 200, sm: 280, md: 360, lg: 420 },
          maxHeight: 'calc(100% - 32px)',
          aspectRatio: '1',
          top: { xs: 24, sm: 12, md: 8 },
          right: { xs: 8, sm: 12, md: 16 },
          borderRadius: '50%',
          bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.1),
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Typography component='h2' variant='h3' id='especialidades-title' sx={{ mb: 8, position: 'relative', zIndex: 1 }}>
        Especialidades médicas
      </Typography>
      <Box sx={{ minHeight: 120, position: 'relative', zIndex: 1 }} aria-busy={state.status === 'loading'}>
        {state.status === 'loading' ? (
          <CircularProgress aria-label='Cargando especialidades' />
        ) : state.status === 'error' ? (
          <Alert severity='info'>
            No pudimos cargar las especialidades. Puedes volver a intentarlo al actualizar la página.
          </Alert>
        ) : state.items.length === 0 ? (
          <Typography color='text.secondary'>No hay especialidades disponibles actualmente.</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 5,
            }}
          >
            {state.items.map((specialty, index) => (
              <Card key={specialty.idSpecialty} variant='outlined' sx={{ height: '100%', boxShadow: 1 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
                  <Typography component='h3' variant='h6' sx={{ overflowWrap: 'anywhere' }}>
                    {specialty.name}
                  </Typography>
                  <MedicalServicesOutlined aria-hidden='true' color={index % 2 ? 'secondary' : 'primary'} />
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </Container>
  );
}

export function SpecialistsSection({ state }: { state: CatalogState<PublicDoctor> }) {
  return (
    <Box
      component='section'
      id='especialistas'
      aria-labelledby='especialistas-title'
      sx={{ bgcolor: 'action.hover', ...sectionSx }}
    >
      <Container maxWidth='lg'>
        <Typography component='h2' variant='h3' id='especialistas-title' align='center' sx={{ mb: 10 }}>
          Nuestros especialistas
        </Typography>
        <Box sx={{ minHeight: 180 }} aria-busy={state.status === 'loading'}>
          {state.status === 'loading' ? (
            <CircularProgress aria-label='Cargando especialistas' />
          ) : state.status === 'error' ? (
            <Alert severity='info'>
              No pudimos cargar los especialistas. Puedes volver a intentarlo al actualizar la página.
            </Alert>
          ) : state.items.length === 0 ? (
            <Typography align='center' color='text.secondary'>
              No hay especialistas disponibles actualmente.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
                gap: { xs: 8, md: 10 },
              }}
            >
              {state.items.map((doctor) => (
                <Stack key={doctor.idDoctor} alignItems='center' gap={3} sx={{ minWidth: 0, textAlign: 'center' }}>
                  <CustomAvatar color='primary' skin='light' size={80} aria-hidden='true'>
                    {doctor.name.trim().charAt(0)}
                    {doctor.lastname.trim().charAt(0)}
                  </CustomAvatar>
                  <Typography component='h3' variant='h6' sx={{ overflowWrap: 'anywhere' }}>
                    {doctor.name} {doctor.lastname}
                  </Typography>
                  {doctor.specialties.length > 0 && (
                    <Typography color='text.secondary' sx={{ overflowWrap: 'anywhere' }}>
                      {doctor.specialties.map(({ name }) => name).join(' · ')}
                    </Typography>
                  )}
                </Stack>
              ))}
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
