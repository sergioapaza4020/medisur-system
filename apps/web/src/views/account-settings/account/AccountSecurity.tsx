'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { myAccountService } from '@/services/users/myAccountService';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { getRegistrationPasswordFeedback } from '@/utils/patientRegistration';

export default function AccountSecurity() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  const router = useRouter();
  const feedback = getRegistrationPasswordFeedback(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    if (!current) {
      setError('Ingresa tu contraseña actual');
      return;
    }
    if (!feedback.valid) {
      setError('Usa al menos 8 caracteres, una mayúscula, una minúscula y un número; máximo 72 bytes.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas deben coincidir');
      return;
    }
    if (password === current) {
      setError('La nueva contraseña debe ser diferente de la actual');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await myAccountService.changePassword(current, password);
      setSuccess(true);
      setCurrent('');
      setPassword('');
      setConfirmation('');
      router.replace('/login');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      setCurrent('');
      setPassword('');
      setConfirmation('');
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title='Seguridad'
        titleTypographyProps={{ component: 'h2' }}
        subheader='Al cambiar tu contraseña se cerrarán todas tus sesiones. Deberás iniciar sesión nuevamente.'
      />
      <CardContent>
        <Box
          component='form'
          noValidate
          onSubmit={submit}
          aria-busy={busy}
          sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          {error && <Alert severity='error'>{error}</Alert>}
          {success && <Alert severity='success'>Contraseña actualizada. Redirigiendo al inicio de sesión…</Alert>}
          <TextField
            required
            fullWidth
            type='password'
            label='Contraseña actual'
            name='currentPassword'
            autoComplete='current-password'
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            disabled={busy}
          />
          <TextField
            required
            fullWidth
            type='password'
            label='Nueva contraseña'
            name='password'
            autoComplete='new-password'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          <Box component='ul' aria-label='Requisitos de contraseña' sx={{ m: 0, pl: 5 }}>
            {feedback.requirements.map((requirement) => (
              <Typography component='li' key={requirement.id}>
                {requirement.label}
              </Typography>
            ))}
          </Box>
          <TextField
            required
            fullWidth
            type='password'
            label='Confirmar nueva contraseña'
            name='confirmPassword'
            autoComplete='new-password'
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
          />
          <Button
            type='submit'
            variant='contained'
            disabled={busy}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
          >
            {busy ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
