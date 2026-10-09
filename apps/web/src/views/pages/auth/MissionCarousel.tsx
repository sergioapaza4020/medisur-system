'use client';

import { useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface MissionSlide {
  title: string;
  highlight: string;
  description: string;
}

interface MissionCarouselProps {
  mode: 'light' | 'dark';
  interval?: number;
}

const slides: MissionSlide[] = [
  {
    title: 'Tecnología para un futuro',
    highlight: 'más saludable',
    description: 'Conectamos profesionales, pacientes y tecnología para una atención en salud más humana y eficiente.',
  },
  {
    title: 'Cuidamos lo que',
    highlight: 'más importa',
    description:
      'Facilitamos el trabajo de los profesionales de salud para brindar una atención ágil, segura y personalizada.',
  },
  {
    title: 'Innovación al servicio',
    highlight: 'de tu salud',
    description: 'Centralizamos información clínica y procesos médicos para mejorar cada experiencia de atención.',
  },
];

const MissionCarousel = ({ mode, interval = 5000 }: MissionCarouselProps) => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, interval);

    return () => {
      window.clearInterval(timer);
    };
  }, [interval]);

  const slide = slides[activeSlide];

  return (
    <Box
      component='section'
      aria-label='Nuestra misión'
      sx={{
        display: { xs: 'none', md: 'block' },
        maxWidth: 360,
      }}
    >
      <Box
        key={activeSlide}
        sx={{
          animation: 'missionCarouselFade 500ms ease',

          '@keyframes missionCarouselFade': {
            from: {
              opacity: 0,
              transform: 'translateY(8px)',
            },
            to: {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
        }}
      >
        <Typography
          component='h2'
          sx={{
            fontSize: {
              md: '2.4rem',
              xl: '2.9rem',
            },
            lineHeight: 1.25,
            fontWeight: 400,
            color: mode === 'dark' ? 'text.primary' : 'primary.dark',
          }}
        >
          {slide.title}

          <Box
            component='span'
            sx={{
              display: 'block',
              fontWeight: 700,
              background: 'linear-gradient(100deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {slide.highlight}
          </Box>
        </Typography>

        <Typography
          sx={{
            mt: 6,
            lineHeight: 1.8,
            color: 'text.secondary',
          }}
        >
          {slide.description}
        </Typography>
      </Box>

      <Box
        role='tablist'
        aria-label='Mensajes destacados'
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mt: 8,
        }}
      >
        {slides.map((_, index) => {
          const isActive = index === activeSlide;

          return (
            <Box
              key={index}
              component='button'
              type='button'
              role='tab'
              aria-selected={isActive}
              aria-label={`Mostrar mensaje ${index + 1}`}
              onClick={() => setActiveSlide(index)}
              sx={{
                p: 0,
                border: 0,
                outline: 0,
                cursor: 'pointer',
                width: (theme) => theme.spacing(isActive ? 10 : 6),
                height: 4,
                borderRadius: 4,
                bgcolor: isActive ? 'primary.main' : 'primary.lightOpacity',
                transition: (theme) =>
                  theme.transitions.create(['width', 'background-color'], {
                    duration: theme.transitions.duration.shorter,
                  }),

                '&:hover': {
                  bgcolor: isActive ? 'primary.main' : 'primary.light',
                },

                '&:focus-visible': {
                  outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 4,
                },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default MissionCarousel;
