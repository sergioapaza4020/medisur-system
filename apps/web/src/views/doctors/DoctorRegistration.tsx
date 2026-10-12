'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Link from 'next/link';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { doctorsService } from '@/services/doctors/doctorsService';
import { specialtiesService } from '@/services/specialties/specialtiesService';
import type { DoctorAccount, DoctorAccountsPage, DoctorsQuery } from '@/types/doctors';
import type { SpecialtiesPage, SpecialtiesQuery, Specialty } from '@/types/specialties';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import tableStyles from '@core/styles/table.module.css';

export default function DoctorRegistration() {
  const { hasPermission } = useAuth();
  const authorized = hasPermission('doctor.create');
  const canReadSpecialties = authorized && hasPermission('specialty.get-all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<DoctorsQuery | null>(null);
  const [accounts, setAccounts] = useState<DoctorAccountsPage | null>(null);
  const [completed, setCompleted] = useState<{ query: DoctorsQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<DoctorAccount | null>(null);
  const [specialtyQuery, setSpecialtyQuery] = useState<SpecialtiesQuery>({ page: 1, limit: 10, status: 'active' });
  const [specialties, setSpecialties] = useState<SpecialtiesPage | null>(null);
  const [specialtiesCompleted, setSpecialtiesCompleted] = useState<{ query: SpecialtiesQuery; refresh: number } | null>(
    null,
  );
  const [chosen, setChosen] = useState<Specialty[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specialtyError, setSpecialtyError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const loading = query !== null && (completed?.query !== query || completed?.refresh !== refresh);
  const loadingSpecialties =
    specialtiesCompleted?.query !== specialtyQuery || specialtiesCompleted?.refresh !== refresh;

  useEffect(() => {
    if (!authorized || !query) return;
    let active = true;
    doctorsService
      .searchUsers(query)
      .then((result) => {
        if (!active) return;
        setError(null);
        if (query.page > Math.max(1, result.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, result.meta.totalPages) });
        else setAccounts(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setAccounts(null);
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

  useEffect(() => {
    if (!canReadSpecialties) return;
    let active = true;
    specialtiesService
      .listPage(specialtyQuery)
      .then((result) => {
        if (!active) return;
        setSpecialtyError(null);
        if (specialtyQuery.page > Math.max(1, result.meta.totalPages))
          setSpecialtyQuery({ ...specialtyQuery, page: Math.max(1, result.meta.totalPages) });
        else setSpecialties(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setSpecialties(null);
          setSpecialtyError(getApiErrorMessage(failure));
        }
      })
      .finally(() => {
        if (active) setSpecialtiesCompleted({ query: specialtyQuery, refresh });
      });
    return () => {
      active = false;
    };
  }, [canReadSpecialties, specialtyQuery, refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || saving.current) return;
    if (!selected?.isActive) {
      setError('Selecciona una cuenta activa existente.');
      return;
    }
    if (chosen.length > 100) {
      setError('Selecciona hasta 100 especialidades.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const doctor = await doctorsService.create({
        idUser: selected.idUser,
        isActive,
        specialtyIds: canReadSpecialties ? chosen.map(({ idSpecialty }) => idSpecialty) : [],
      });
      setSelected(null);
      setChosen([]);
      setIsActive(true);
      setSuccess(`Médico registrado correctamente: ${doctor.user.name} ${doctor.user.lastname}.`);
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!authorized) return <Alert severity='warning'>No tienes permiso para registrar médicos.</Alert>;

  return (
    <Stack spacing={3}>
      <Typography variant='h5'>Registrar médico especialista</Typography>
      {error && <Alert severity='error'>{error}</Alert>}
      {success && (
        <Alert severity='success' onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant='h6'>Seleccionar cuenta existente</Typography>
            <Typography>
              Busca por nombre, correo o documento. Se conservarán los datos y roles actuales de la cuenta.
            </Typography>
            {['user.create', 'user.assign-roles', 'user.get-all'].every(hasPermission) && (
              <Button component={Link} href='/dashboard/users'>
                Crear cuenta desde Usuarios
              </Button>
            )}
            <Box
              component='form'
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                if (!authorized || busy || search.trim().length < 3) return;
                setQuery({ page: 1, limit: query?.limit ?? 10, status: 'all', search: search.trim() });
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  name='search'
                  label='Nombre, correo o documento'
                  value={search}
                  disabled={busy}
                  onChange={(event) => setSearch(event.target.value)}
                  inputProps={{ maxLength: 200 }}
                  helperText='Ingresa al menos 3 caracteres'
                />
                <Button type='submit' disabled={busy || search.trim().length < 3}>
                  Buscar
                </Button>
              </Stack>
            </Box>
            {loading ? (
              <CircularProgress aria-label='Buscando cuentas' />
            ) : (
              accounts &&
              query && (
                <>
                  <div className='overflow-x-auto'>
                    <table className={tableStyles.table}>
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Correo</th>
                          <th>Documento</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.data.map((account) => (
                          <tr key={account.idUser}>
                            <td>
                              {account.name} {account.lastname}
                            </td>
                            <td>{account.email}</td>
                            <td>{account.ci}</td>
                            <td>{account.isActive ? 'Activo' : 'Inactivo'}</td>
                            <td>
                              <Button
                                disabled={busy || !account.isActive}
                                onClick={() => {
                                  if (!busy && account.isActive && authorized) setSelected(account);
                                }}
                              >
                                {selected?.idUser === account.idUser ? 'Seleccionado' : 'Seleccionar'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {accounts.data.length === 0 && <Typography>No se encontraron cuentas.</Typography>}
                  <ListPagination
                    query={query}
                    meta={accounts.meta}
                    disabled={busy}
                    onChange={(pagination) => setQuery((current) => current && { ...current, ...pagination })}
                  />
                </>
              )
            )}
            {error && query && !loading && (
              <Button disabled={busy} onClick={() => setRefresh((value) => value + 1)}>
                Reintentar búsqueda
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Box component='form' onSubmit={save}>
            <Stack spacing={3}>
              <Typography variant='h6'>Perfil médico</Typography>
              <Typography>
                {selected
                  ? `${selected.name} ${selected.lastname} — ${selected.email}`
                  : 'Selecciona una cuenta para registrar al médico.'}
              </Typography>
              <FormControlLabel
                label='Médico activo'
                control={
                  <Checkbox
                    name='isActive'
                    checked={isActive}
                    disabled={busy}
                    onChange={(_, checked) => setIsActive(checked)}
                  />
                }
              />
              <Typography>Especialidades (opcional). Puedes seleccionar más de una.</Typography>
              {canReadSpecialties ? (
                <>
                  {specialtyError && (
                    <Alert
                      severity='error'
                      action={
                        <Button disabled={busy} onClick={() => setRefresh((value) => value + 1)}>
                          Reintentar
                        </Button>
                      }
                    >
                      {specialtyError}
                    </Alert>
                  )}
                  {loadingSpecialties ? (
                    <CircularProgress aria-label='Cargando especialidades' />
                  ) : (
                    specialties && (
                      <>
                        {specialties.data
                          .filter((specialty) => specialty.isActive)
                          .map((specialty) => (
                            <FormControlLabel
                              key={specialty.idSpecialty}
                              label={specialty.name}
                              control={
                                <Checkbox
                                  checked={chosen.some(({ idSpecialty }) => idSpecialty === specialty.idSpecialty)}
                                  disabled={busy}
                                  onChange={(_, checked) =>
                                    setChosen((current) =>
                                      checked
                                        ? [
                                            ...current.filter(
                                              ({ idSpecialty }) => idSpecialty !== specialty.idSpecialty,
                                            ),
                                            specialty,
                                          ]
                                        : current.filter(({ idSpecialty }) => idSpecialty !== specialty.idSpecialty),
                                    )
                                  }
                                />
                              }
                            />
                          ))}
                        {specialties.data.length === 0 && <Typography>No hay especialidades activas.</Typography>}
                        <ListPagination
                          query={specialtyQuery}
                          meta={specialties.meta}
                          disabled={busy}
                          onChange={(pagination) => setSpecialtyQuery((current) => ({ ...current, ...pagination }))}
                          labelRowsPerPage='Especialidades por página'
                        />
                      </>
                    )
                  )}
                  {chosen.length > 0 && (
                    <Typography>Seleccionadas: {chosen.map(({ name }) => name).join(', ')}</Typography>
                  )}
                </>
              ) : (
                <Typography>
                  No tienes permiso para consultar especialidades. Puedes registrar el perfil sin asociaciones.
                </Typography>
              )}
              <Typography>
                Se asignará el rol DOCTOR conservando los demás roles. La cuenta mantiene su acceso habitual.
              </Typography>
              <Button variant='contained' type='submit' disabled={busy || !selected?.isActive}>
                {busy ? 'Registrando…' : 'Registrar médico'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
