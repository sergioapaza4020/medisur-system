'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Logo from '@components/layout/shared/Logo';
import { authService } from '@/services/auth/authService';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { getRegistrationPasswordFeedback } from '@/utils/patientRegistration';

const invalidLink = 'El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.';

export default function ResetPassword({ token }: { token: string }) {
  const tokenWellFormed = /^[a-f0-9]{64}$/.test(token);
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'error' | 'success'>(
    tokenWellFormed ? 'checking' : 'invalid',
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const router = useRouter();
  const feedback = getRegistrationPasswordFeedback(password);

  useEffect(() => {
    let active = true;
    if (!tokenWellFormed) return;
    authService
      .validateRecoveryToken(token)
      .then(() => {
        if (active) setStatus('valid');
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(getApiErrorMessage(failure));
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [token, tokenWellFormed, retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || status !== 'valid') return;
    if (!feedback.valid) {
      setError('Usa al menos 8 caracteres, una mayúscula, una minúscula y un número; máximo 72 bytes.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas deben coincidir');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await authService.resetPassword(token, password, confirmation);
      setPassword('');
      setConfirmation('');
      setStatus('success');
      router.replace('/login');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      setPassword('');
      setConfirmation('');
      setStatus('error');
      inFlight.current = false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      component='main'
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, sm: 6 },
        bgcolor: 'background.default',
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 540,
          borderRadius: 5,
          border: '1px solid var(--mui-palette-primary-lighterOpacity)',
          boxShadow: '0 12px 48px var(--mui-palette-primary-lighterOpacity)',
        }}
      >
        <CardContent sx={{ p: { xs: 5, sm: 9 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 5 }}>
            <Logo logoSize={54} />
          </Box>
          <Typography component='h1' variant='h4' sx={{ mb: 4 }}>
            Restablecer contraseña
          </Typography>
          {status === 'checking' && (
            <Box role='status' sx={{ display: 'flex', gap: 3 }}>
              <CircularProgress size={24} />
              Verificando enlace…
            </Box>
          )}
          {status === 'invalid' && <Alert severity='error'>{invalidLink}</Alert>}
          {error && (
            <Alert severity='error' sx={{ mb: 4 }}>
              {error}
            </Alert>
          )}
          {status !== 'valid' && status !== 'checking' && status !== 'success' && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'stretch',
                justifyContent: 'center',
                gap: 2,
                mt: 4,
              }}
            >
              {status === 'error' && (
                <Button
                  variant='text'
                  onClick={() => {
                    setError(null);
                    setStatus('checking');
                    setRetry((value) => value + 1);
                  }}
                  sx={{
                    flex: 1,
                    minHeight: 44,
                  }}
                >
                  Volver a verificar el enlace
                </Button>
              )}

              <Button
                component={Link}
                href='/forgot-password'
                variant='text'
                sx={{
                  flex: 1,
                  minHeight: 44,
                }}
              >
                Solicitar otro enlace
              </Button>
            </Box>
          )}
          {status === 'success' && (
            <Alert severity='success'>Contraseña restablecida. Redirigiendo al inicio de sesión…</Alert>
          )}
          {status === 'valid' && (
            <Box
              component='form'
              noValidate
              onSubmit={submit}
              aria-busy={busy}
              sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}
            >
              <TextField
                label='Nueva contraseña'
                name='password'
                type='password'
                autoComplete='new-password'
                required
                fullWidth
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <Box component='ul' sx={{ m: 0, pl: 5 }} aria-label='Requisitos de contraseña'>
                {feedback.requirements.map((requirement) => (
                  <Typography
                    component='li'
                    key={requirement.id}
                    color={requirement.met ? 'success.main' : 'text.secondary'}
                  >
                    {requirement.label}
                  </Typography>
                ))}
              </Box>
              <TextField
                label='Confirmar nueva contraseña'
                name='confirmPassword'
                type='password'
                autoComplete='new-password'
                required
                fullWidth
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={busy}
              />
              <Button type='submit' variant='contained' disabled={busy}>
                {busy ? 'Guardando…' : 'Restablecer contraseña'}
              </Button>
            </Box>
          )}
          <Button component={Link} href='/login' fullWidth sx={{ mt: 5 }}>
            Volver a inicio de sesión
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
