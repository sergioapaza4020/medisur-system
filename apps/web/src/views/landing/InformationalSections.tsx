import { Box, Container, Stack, Typography } from '@mui/material';
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined';
import MedicalServicesOutlined from '@mui/icons-material/MedicalServicesOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';

import { sectionSx } from './landingStyles';

const steps = [
  {
    title: 'Crea tu cuenta',
    description: 'Regístrate como paciente para acceder a los servicios digitales de MEDISUR.',
    Icon: PersonAddOutlined,
  },
  {
    title: 'Elige una especialidad',
    description: 'Busca el área médica que necesitas.',
    Icon: MedicalServicesOutlined,
  },
  {
    title: 'Selecciona un médico',
    description: 'Consulta los profesionales disponibles para esa especialidad.',
    Icon: BadgeOutlined,
  },
  {
    title: 'Reserva tu cita',
    description: 'Selecciona una fecha y horario disponible cuando se habilite el módulo de citas.',
    Icon: EventAvailableOutlined,
  },
];

const benefits = [
  {
    title: 'Especialistas calificados',
    description: 'Accede a profesionales registrados en las especialidades disponibles en MEDISUR.',
    Icon: VerifiedOutlined,
  },
  {
    title: 'Atención organizada de citas',
    description:
      'El módulo de citas está previsto para reunir la gestión de tus próximas atenciones en un mismo sistema.',
    Icon: CalendarMonthOutlined,
  },
  {
    title: 'Atención cercana',
    description: 'Encuentra información clara sobre especialistas y servicios disponibles.',
    Icon: FavoriteBorderOutlined,
  },
  {
    title: 'Acceso seguro',
    description: 'El sistema controla el acceso a la información mediante autenticación y permisos.',
    Icon: LockOutlined,
  },
];

export function HowItWorksSection() {
  return (
    <Container
      component='section'
      id='como-funciona'
      aria-labelledby='como-funciona-title'
      maxWidth='lg'
      sx={sectionSx}
    >
      <Typography component='h2' variant='h3' id='como-funciona-title' align='center' sx={{ mb: 4 }}>
        ¿Cómo funciona MEDISUR?
      </Typography>
      <Typography align='center' color='text.secondary' sx={{ mb: 10 }}>
        Conoce el proceso previsto para gestionar tu atención. Las reservas en línea aún no están habilitadas.
      </Typography>
      <Box
        component='ol'
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 8,
        }}
      >
        {steps.map(({ title, description, Icon }, index) => (
          <Stack
            component='li'
            key={title}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            gap={3}
            sx={{ textAlign: { xs: 'left', md: 'center' } }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                color: index === 3 ? 'secondary.main' : 'primary.main',
                bgcolor: 'action.hover',
                borderRadius: 8,
                px: 4,
                py: 2,
              }}
            >
              <Icon aria-hidden='true' />
              <Typography component='span' color='inherit' fontWeight={700}>
                {index + 1}
              </Typography>
            </Box>
            <Typography component='h3' variant='h6'>
              {title}
            </Typography>
            <Typography color='text.secondary'>{description}</Typography>
          </Stack>
        ))}
      </Box>
    </Container>
  );
}

export function BenefitsSection() {
  return (
    <Container component='section' aria-labelledby='beneficios-title' maxWidth='lg' sx={sectionSx}>
      <Typography component='h2' variant='h3' id='beneficios-title' sx={{ mb: 10 }}>
        ¿Por qué elegir MEDISUR?
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 8 }}>
        {benefits.map(({ title, description, Icon }, index) => (
          <Stack key={title} direction='row' alignItems='flex-start' gap={4}>
            <Box
              sx={{
                display: 'flex',
                p: 3,
                bgcolor: 'action.hover',
                borderRadius: '50%',
                color: index % 2 ? 'secondary.main' : 'primary.main',
              }}
            >
              <Icon aria-hidden='true' />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component='h3' variant='h6' sx={{ mb: 2 }}>
                {title}
              </Typography>
              <Typography color='text.secondary'>{description}</Typography>
            </Box>
          </Stack>
        ))}
      </Box>
    </Container>
  );
}
