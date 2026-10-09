'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import type { Mode } from '@core/types';
import Logo from '@components/layout/shared/Logo';
import DirectionalIcon from '@components/DirectionalIcon';

const homeHref = '/dashboard';

const NotFound = ({ mode }: { mode: Mode }) => {
  const router = useRouter();

  const handleBack = () => {
    // A freshly opened browser tab can include an empty entry in its history.
    if (window.history.length > 2 || (window.history.length > 1 && document.referrer)) {
      router.back();
    } else {
      router.replace(homeHref);
    }
  };

  return (
    <Box
      component='main'
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 6, sm: 8, lg: 12 },
        bgcolor: 'background.default',
        backgroundImage:
          'radial-gradient(ellipse at 80% 15%, var(--mui-palette-primary-lighterOpacity), transparent 55%)',
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          pointerEvents: 'none',
          borderRadius: '50%',
        },
        '&::before': {
          width: '110%',
          height: 280,
          bottom: -200,
          left: '-25%',
          bgcolor: 'primary.lightOpacity',
          transform: 'rotate(10deg)',
        },
        '&::after': {
          width: '80%',
          height: 240,
          bottom: -180,
          right: '-25%',
          bgcolor: 'secondary.lighterOpacity',
          transform: 'rotate(-12deg)',
        },
        '& a:focus-visible, & button:focus-visible': {
          outline: '2px solid var(--mui-palette-primary-main)',
          outlineOffset: 4,
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1440,
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
          alignItems: 'center',
          gap: { xs: 8, md: 10, lg: 16 },
        }}
      >
        <Box sx={{ textAlign: { xs: 'center', md: 'start' } }}>
          <Box
            component={Link}
            href={homeHref}
            aria-label='MEDISUR, inicio'
            sx={{ display: 'inline-flex', mb: { xs: 8, md: 12 } }}
          >
            <Logo logoSize={60} />
          </Box>
          <Typography
            component='p'
            aria-label='Error 404'
            sx={{
              fontSize: { xs: '7rem', sm: '10rem', lg: '12rem' },
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: mode === 'dark' ? 'text.primary' : 'primary.dark',
              mb: 5,
            }}
          >
            4
            <Box component='span' sx={{ color: 'primary.main' }}>
              0
            </Box>
            4
          </Typography>
          <Typography
            component='h1'
            sx={{
              fontSize: { xs: '1.8rem', sm: '2.25rem', lg: '2.75rem' },
              fontWeight: 700,
              lineHeight: 1.2,
              color: mode === 'dark' ? 'text.primary' : 'primary.dark',
            }}
          >
            Página no encontrada
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              mt: 4,
              mb: 8,
              fontSize: { xs: '1rem', lg: '1.125rem' },
              lineHeight: 1.7,
              maxWidth: 520,
              mx: { xs: 'auto', md: 0 },
            }}
          >
            La página que estabas buscando no existe o puede haber sido movida a otra dirección.
          </Typography>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'center', md: 'flex-start' }, gap: 3 }}
          >
            <Button
              component={Link}
              href={homeHref}
              variant='contained'
              disableElevation
              startIcon={<i aria-hidden='true' className='ri-home-line' />}
              endIcon={<i aria-hidden='true' className='ri-arrow-right-line' />}
              sx={{ minHeight: 54, px: 6, borderRadius: 2.5, fontSize: '1rem', maxWidth: '100%' }}
            >
              Volver al inicio
            </Button>
            <Button
              type='button'
              onClick={handleBack}
              startIcon={
                <Box component='span' aria-hidden='true' sx={{ display: 'inline-flex' }}>
                  <DirectionalIcon ltrIconClass='ri-arrow-left-line' rtlIconClass='ri-arrow-right-line' />
                </Box>
              }
              sx={{ minHeight: 44, borderRadius: 2.5 }}
            >
              Volver atrás
            </Button>
          </Box>
        </Box>

        <Box
          aria-hidden='true'
          sx={{
            display: { xs: 'none', md: 'flex' },
            position: 'relative',
            minHeight: { md: 420, lg: 560 },
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '5%',
              borderRadius: '50%',
              background:
                'linear-gradient(160deg, var(--mui-palette-primary-lightOpacity), var(--mui-palette-secondary-lighterOpacity))',
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '85%',
              transform: 'rotate(6deg)',
              borderRadius: 5,
              border: '1px solid var(--mui-palette-primary-lightOpacity)',
              bgcolor: 'background.paper',
              boxShadow: '0 12px 48px var(--mui-palette-primary-lighterOpacity)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 4,
                bgcolor: 'primary.lighterOpacity',
                borderBottom: '1px solid var(--mui-palette-primary-lightOpacity)',
              }}
            >
              {['primary.main', 'primary.light', 'secondary.light'].map((color) => (
                <Box key={color} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
              ))}
              <Box sx={{ ml: 3, width: '55%', height: 8, borderRadius: 2, bgcolor: 'primary.lightOpacity' }} />
            </Box>
            <Box sx={{ p: { md: 6, lg: 10 }, textAlign: 'center' }}>
              <Typography
                sx={{ color: 'primary.main', fontSize: { md: '5rem', lg: '7rem' }, fontWeight: 800, lineHeight: 1.2 }}
              >
                404
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, mt: 5 }}>
                <Box sx={{ width: '70%', height: 10, borderRadius: 3, bgcolor: 'primary.lightOpacity' }} />
                <Box sx={{ width: '50%', height: 10, borderRadius: 3, bgcolor: 'primary.lighterOpacity' }} />
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              top: '15%',
              color: 'primary.dark',
              transform: 'rotate(-12deg)',
              fontSize: { md: 84, lg: 120 },
            }}
          >
            <i className='ri-stethoscope-line' style={{ fontSize: 'inherit' }} />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              bottom: '8%',
              p: { md: 4, lg: 6 },
              borderRadius: 4,
              bgcolor: 'background.paper',
              color: 'secondary.main',
              border: '1px solid var(--mui-palette-primary-lightOpacity)',
              boxShadow: '0 12px 48px var(--mui-palette-primary-lighterOpacity)',
              fontSize: 48,
            }}
          >
            <i className='ri-heart-pulse-line' style={{ fontSize: 'inherit' }} />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              bottom: '8%',
              p: 4,
              borderRadius: 4,
              bgcolor: 'primary.lightOpacity',
              color: 'primary.main',
              fontSize: 40,
            }}
          >
            <i className='ri-search-line' style={{ fontSize: 'inherit' }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default NotFound;
