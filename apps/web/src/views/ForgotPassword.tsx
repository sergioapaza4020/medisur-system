'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Link from 'next/link';

import Alert from '@mui/material/Alert';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';

import InputAdornment from '@mui/material/InputAdornment';

import Button from '@mui/material/Button';

import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { authService } from '@/services/auth/authService';

import type { Mode } from '@core/types';
import Logo from '@components/layout/shared/Logo';

import MissionCarousel from '@/views/pages/auth/MissionCarousel';
import Form from '@components/Form';
import DirectionalIcon from '@components/DirectionalIcon';
import ModeDropdown from '@/components/layout/shared/ModeDropdown';

const ForgotPassword = ({ mode }: { mode: Mode }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    setSuccess(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
      setError('Ingresa un correo electrónico válido');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      setSuccess(await authService.requestPasswordRecovery(email));
    } catch (error) {
      setError(getApiErrorMessage(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Box
      component='main'
      sx={{
        minHeight: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, sm: 6, lg: 8 },
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
          width: '85%',
          height: 260,
          bottom: -180,
          left: '-20%',
          bgcolor: 'primary.lightOpacity',
          transform: 'rotate(12deg)',
        },
        '&::after': {
          width: 420,
          height: 420,
          top: -300,
          right: '12%',
          border: '60px solid var(--mui-palette-primary-lighterOpacity)',
        },
        '& a:focus-visible': {
          outline: '2px solid var(--mui-palette-primary-main)',
          outlineOffset: 4,
          borderRadius: 1,
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1440,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 540px)',
            md: 'minmax(0, 1fr) minmax(0, 500px)',
            lg: '1fr minmax(0, 540px) 1fr',
          },
          justifyContent: 'center',
          alignItems: 'center',
          gap: { md: 6, lg: 8 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          component='section'
          aria-label='Nuestra misión'
          sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 360 }}
        >
          <MissionCarousel mode={mode} />
        </Box>

        <Card
          sx={{
            width: '100%',
            borderRadius: 5,
            border: '1px solid var(--mui-palette-primary-lighterOpacity)',
            boxShadow: '0 12px 48px var(--mui-palette-primary-lighterOpacity)',
          }}
        >
          <CardContent sx={{ p: { xs: 5, sm: 9 }, '&:last-child': { pb: { xs: 5, sm: 9 } }, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 2, right: 2, zIndex: 1 }}>
              <ModeDropdown />
            </Box>
            <Box
              component={Link}
              href='/'
              aria-label='MEDISUR, inicio'
              sx={{ display: 'flex', justifyContent: 'center', mb: 7 }}
            >
              <Logo logoSize={54} />
            </Box>
            <Box sx={{ textAlign: 'center', mb: 7 }}>
              <Typography
                component='h1'
                variant='h4'
                sx={{
                  fontSize: { xs: '1.6rem', sm: '1.9rem' },
                  fontWeight: 700,
                  color: mode === 'dark' ? 'text.primary' : 'primary.dark',
                }}
              >
                ¿Olvidaste tu contraseña? 🔐
              </Typography>
              <Typography sx={{ mt: 2, color: 'text.secondary', lineHeight: 1.6 }}>
                Ingresa tu correo electrónico y te enviaremos instrucciones para reiniciar tu contraseña.
              </Typography>
            </Box>
            <Box
              component={Form}
              noValidate
              onSubmit={handleSubmit}
              aria-busy={busy}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                '& .MuiOutlinedInput-root': { minHeight: 54, borderRadius: 2.5 },
                '& .MuiInputLabel-root:not(.Mui-focused):not(.Mui-error)': { color: 'text.secondary' },
              }}
            >
              {error && <Alert severity='error'>{error}</Alert>}
              {success && (
                <Alert severity='success' role='status'>
                  {success}
                </Alert>
              )}
              <TextField
                autoFocus
                fullWidth
                id='forgot-password-email'
                name='email'
                type='email'
                autoComplete='email'
                label='Correo electrónico'
                placeholder='tu@correo.com'
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                inputProps={{ maxLength: 254 }}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i aria-hidden='true' className='ri-mail-line' />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                fullWidth
                variant='contained'
                type='submit'
                disableElevation
                disabled={busy}
                sx={{ minHeight: 52, borderRadius: 2.5, fontSize: '1rem' }}
              >
                {busy ? 'Enviando…' : 'Enviar enlace para reiniciar'}
              </Button>
              <Typography
                component={Link}
                href='/login'
                color='primary'
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  minHeight: 44,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                <Box component='span' aria-hidden='true' sx={{ display: 'inline-flex' }}>
                  <DirectionalIcon ltrIconClass='ri-arrow-left-s-line' rtlIconClass='ri-arrow-right-s-line' />
                </Box>
                Volver a inicio de sesión
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Box
          aria-hidden='true'
          sx={{
            display: { xs: 'none', lg: 'flex' },
            position: 'relative',
            minHeight: 520,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '48% 48% 40% 40%',
            overflow: 'hidden',
            background:
              'linear-gradient(160deg, var(--mui-palette-primary-lighterOpacity), var(--mui-palette-secondary-lighterOpacity))',
          }}
        >
          <Box sx={{ position: 'relative', width: '80%', minHeight: 320 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 280,
                border: '1px solid var(--mui-palette-primary-lightOpacity)',
                borderRadius: 6,
                bgcolor: 'primary.lighterOpacity',
                transform: 'rotate(-8deg)',
                color: 'primary.main',
              }}
            >
              <i className='ri-mail-open-line' style={{ fontSize: 120 }} />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                p: 5,
                borderRadius: 4,
                border: '1px solid var(--mui-palette-primary-lightOpacity)',
                bgcolor: 'background.paper',
                boxShadow: '0 12px 48px var(--mui-palette-primary-lighterOpacity)',
                color: 'secondary.main',
              }}
            >
              <i className='ri-lock-line' style={{ fontSize: 48 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ width: 56, height: 5, borderRadius: 2, bgcolor: 'primary.lightOpacity' }} />
                <Box sx={{ width: 40, height: 5, borderRadius: 2, bgcolor: 'primary.lightOpacity' }} />
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(0deg, var(--mui-palette-background-default), transparent 35%)',
              pointerEvents: 'none',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default ForgotPassword;
