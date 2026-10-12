'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { usersService } from '@/services/users/usersService';
import type { PatientRegistration } from '@/types/auth';
import type { PatientRegistrationMatches, UsersQuery } from '@/types/users';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { emptyPatientRegistration, validatePatientRegistration } from '@/utils/patientRegistration';
import tableStyles from '@core/styles/table.module.css';

const labels: Record<keyof PatientRegistration, string> = {
  name: 'Nombres',
  lastname: 'Apellidos',
  email: 'Correo electrónico',
  ci: 'Documento de identidad',
  password: 'Contraseña inicial',
};

export default function AdministrativePatientRegistration() {
  const { hasPermission } = useAuth();
  const authorized = hasPermission('user.create-patient');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<UsersQuery | null>(null);
  const [page, setPage] = useState<PatientRegistrationMatches | null>(null);
  const [completed, setCompleted] = useState<{ query: UsersQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState<PatientRegistration>(emptyPatientRegistration);
  const [errors, setErrors] = useState<Partial<Record<keyof PatientRegistration, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordShown, setPasswordShown] = useState(false);
  const saving = useRef(false);
  const loading = query !== null && (completed?.query !== query || completed?.refresh !== refresh);

  useEffect(() => {
    if (!authorized || !query) return;
    let active = true;
    usersService
      .searchForPatientRegistration(query)
      .then((result) => {
        if (!active) return;
        if (query.page > Math.max(1, result.meta.totalPages))
          setQuery((current) => current && { ...current, page: Math.max(1, result.meta.totalPages) });
        else setPage(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setPage(null);
          setError(getApiErrorMessage(failure));
        }
      })
      .finally(() => {
        if (active) setCompleted({ query, refresh });
      });
    return () => {
      active = false;
    };
  }, [authorized, query, refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || saving.current) return;
    const validation = validatePatientRegistration(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const patient = await usersService.createPatient({
        name: form.name.trim(),
        lastname: form.lastname.trim(),
        email: form.email.trim().toLowerCase(),
        ci: form.ci.trim(),
        password: form.password,
      });
      setForm(emptyPatientRegistration);
      setPasswordShown(false);
      setSuccess(
        `Paciente registrado correctamente: ${patient.email}. Puede iniciar sesión con su correo y contraseña.`,
      );
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      setForm((current) => ({ ...current, password: '' }));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!authorized) return <Alert severity='warning'>No tienes permiso para registrar pacientes.</Alert>;

  return (
    <Stack spacing={3}>
      <Typography variant='h5'>Registro administrativo de pacientes</Typography>
      {error && (
        <Alert severity='error' sx={{ whiteSpace: 'pre-line' }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity='success' onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant='h6'>Buscar una cuenta existente</Typography>
            <Typography>
              Busca por nombre, correo o documento antes de registrar al paciente. También se muestran cuentas inactivas
              y de otros perfiles para evitar duplicados.
            </Typography>
            <Box
              component='form'
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                if (!authorized || busy || search.trim().length < 3) return;
                setError(null);
                setQuery({ page: 1, limit: query?.limit ?? 10, status: 'all', search: search.trim() });
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label='Nombre, correo o documento'
                  name='search'
                  value={search}
                  disabled={busy}
                  onChange={(event) => setSearch(event.target.value)}
                  inputProps={{ maxLength: 200 }}
                  helperText='Ingresa al menos 3 caracteres'
                />
                <Button type='submit' variant='outlined' disabled={busy || search.trim().length < 3}>
                  Buscar
                </Button>
              </Stack>
            </Box>
            {loading ? (
              <CircularProgress aria-label='Buscando cuentas existentes' />
            ) : (
              page &&
              query && (
                <>
                  <div className='overflow-x-auto'>
                    <table className={tableStyles.table}>
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Correo</th>
                          <th>Documento</th>
                          <th>Perfil</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page.data.map((account) => (
                          <tr key={account.idUser}>
                            <td>
                              {account.name} {account.lastname}
                            </td>
                            <td>{account.email}</td>
                            <td>{account.ci}</td>
                            <td>{account.isPatient ? 'Paciente' : 'Cuenta de otro perfil'}</td>
                            <td>
                              <Chip
                                size='small'
                                variant='tonal'
                                label={account.isActive ? 'Activo' : 'Inactivo'}
                                color={account.isActive ? 'success' : 'secondary'}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {page.data.length === 0 && <Typography>No se encontraron cuentas coincidentes.</Typography>}
                  {page.data.length > 0 && (
                    <Alert severity='info'>
                      Si la cuenta ya existe, utiliza el registro existente. Una cuenta inactiva requiere revisión por
                      el personal autorizado.
                    </Alert>
                  )}
                  <ListPagination
                    query={query}
                    meta={page.meta}
                    disabled={busy}
                    onChange={(pagination) => setQuery((current) => current && { ...current, ...pagination })}
                  />
                </>
              )
            )}
            {error && query && !loading && (
              <Button
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setRefresh((value) => value + 1);
                }}
              >
                Reintentar búsqueda
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Box component='form' noValidate onSubmit={save}>
            <Stack spacing={3}>
              <Typography variant='h6'>Crear cuenta de paciente</Typography>
              {(['name', 'lastname', 'email', 'ci', 'password'] as const).map((field) => (
                <TextField
                  key={field}
                  fullWidth
                  required
                  name={field}
                  label={labels[field]}
                  disabled={busy}
                  value={form[field]}
                  type={
                    field === 'password' ? (passwordShown ? 'text' : 'password') : field === 'email' ? 'email' : 'text'
                  }
                  autoComplete={
                    field === 'password'
                      ? 'new-password'
                      : field === 'name'
                        ? 'given-name'
                        : field === 'lastname'
                          ? 'family-name'
                          : field === 'email'
                            ? 'email'
                            : 'off'
                  }
                  error={Boolean(errors[field])}
                  helperText={
                    errors[field] ??
                    (field === 'password'
                      ? 'Mínimo 8 caracteres, una mayúscula, una minúscula y un número.'
                      : undefined)
                  }
                  inputProps={{
                    maxLength: field === 'email' ? 254 : field === 'ci' ? 30 : field === 'password' ? 72 : 100,
                  }}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, [field]: event.target.value }));
                    setErrors((current) => ({ ...current, [field]: undefined }));
                  }}
                  InputProps={
                    field === 'password'
                      ? {
                          endAdornment: (
                            <InputAdornment position='end'>
                              <IconButton
                                disabled={busy}
                                type='button'
                                aria-label={passwordShown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                onClick={() => setPasswordShown((shown) => !shown)}
                              >
                                <i className={passwordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                              </IconButton>
                            </InputAdornment>
                          ),
                        }
                      : undefined
                  }
                />
              ))}
              <Typography variant='body2'>
                La cuenta se creará activa con el perfil de paciente. Comunica las credenciales al paciente por el canal
                autorizado del centro médico.
              </Typography>
              <Button variant='contained' type='submit' disabled={busy}>
                {busy ? 'Registrando…' : 'Registrar paciente'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
