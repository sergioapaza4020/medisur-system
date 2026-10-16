'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/GridLegacy';
import TextField from '@mui/material/TextField';

import { myAccountService } from '@/services/users/myAccountService';
import type { MyAccount, UserFields } from '@/types/users';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { validatePersonalData } from '@/utils/patientRegistration';
import AccountPhoto from './AccountPhoto';
import { useAuth } from '@/components/auth/AuthGuard';

const fields = { name: 'Nombre', lastname: 'Apellido', email: 'Correo electrónico', ci: 'Documento' } as const;

export default function AccountDetails() {
  const [saved, setSaved] = useState<MyAccount | null>(null);
  const { updateProfile } = useAuth();
  const [form, setForm] = useState<UserFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof UserFields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    myAccountService.get().then(
      (account) => {
        if (active) {
          setSaved(account);
          setForm(account);
        }
      },
      (failure: unknown) => {
        if (active) setError(getApiErrorMessage(failure));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const changes: Partial<UserFields> = {};
  if (form && saved) {
    for (const field of Object.keys(fields) as (keyof UserFields)[]) {
      if (form[field] !== saved[field]) changes[field] = form[field];
    }
  }
  const dirty = Object.keys(changes).length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !dirty || inFlight.current) return;
    const validation = validatePersonalData(form);
    setErrors(validation);
    setSuccess(false);
    setError(null);
    if (Object.keys(validation).length) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const account = await myAccountService.update(changes);
      setSaved((current) => (current ? { ...account, avatarUrl: current.avatarUrl } : account));
      setForm(account);
      setSuccess(true);
      updateProfile({ name: account.name, lastname: account.lastname, email: account.email });
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title='Información de la cuenta'
        subheader='Gestiona tus datos personales en MEDISUR.'
        titleTypographyProps={{ component: 'h1' }}
      />
      <CardContent>
        {error && (
          <Alert severity='error' sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity='success' sx={{ mb: 4 }}>
            Datos actualizados correctamente
          </Alert>
        )}
        {!form ? (
          error ? (
            <Button
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Reintentar
            </Button>
          ) : (
            <CircularProgress aria-label='Cargando cuenta' />
          )
        ) : (
          <>
            {saved && (
              <AccountPhoto
                account={saved}
                onChange={(avatarUrl) => setSaved((current) => (current ? { ...current, avatarUrl } : current))}
              />
            )}
            <Box component='form' noValidate onSubmit={submit} aria-busy={busy}>
              <Grid container spacing={5}>
                {(Object.keys(fields) as (keyof UserFields)[]).map((field) => (
                  <Grid item xs={12} sm={6} key={field}>
                    <TextField
                      fullWidth
                      required
                      name={field}
                      label={fields[field]}
                      value={form[field]}
                      type={field === 'email' ? 'email' : 'text'}
                      disabled={busy}
                      autoComplete={
                        field === 'name'
                          ? 'given-name'
                          : field === 'lastname'
                            ? 'family-name'
                            : field === 'email'
                              ? 'email'
                              : 'off'
                      }
                      error={!!errors[field]}
                      helperText={errors[field]}
                      onChange={(event) => {
                        setForm({ ...form, [field]: event.target.value });
                        setSuccess(false);
                      }}
                    />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    <Button type='submit' variant='contained' disabled={busy || !dirty}>
                      {busy ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                    <Button
                      disabled={busy || !dirty}
                      onClick={() => {
                        setForm(saved);
                        setErrors({});
                        setError(null);
                        setSuccess(false);
                      }}
                    >
                      Restablecer
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
