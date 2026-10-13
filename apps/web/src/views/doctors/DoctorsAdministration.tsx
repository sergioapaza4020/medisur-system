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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { doctorsService } from '@/services/doctors/doctorsService';
import type { Doctor, DoctorsPage, DoctorsQuery } from '@/types/doctors';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import tableStyles from '@core/styles/table.module.css';
import DoctorSpecialtiesDialog from './DoctorSpecialtiesDialog';

export default function DoctorsAdministration() {
  const { hasPermission } = useAuth();
  const canList = hasPermission('doctor.get-all');
  const [query, setQuery] = useState<DoctorsQuery>({ page: 1, limit: 10, status: 'all', search: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<DoctorsPage | null>(null);
  const [completed, setCompleted] = useState<{ query: DoctorsQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [target, setTarget] = useState<Doctor | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [specialtiesTarget, setSpecialtiesTarget] = useState<number | null>(null);
  const saving = useRef(false);
  const loading = completed?.query !== query || completed?.refresh !== refresh;
  useEffect(() => {
    if (!canList) return;
    let active = true;
    doctorsService
      .list(query)
      .then((result) => {
        if (!active) return;
        setError(null);
        if (query.page > Math.max(1, result.meta.totalPages))
          setQuery({ ...query, page: Math.max(1, result.meta.totalPages) });
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
  }, [canList, query, refresh]);

  async function changeStatus() {
    if (!target || saving.current || !hasPermission(target.isActive ? 'doctor.delete' : 'doctor.reactivate')) return;
    saving.current = true;
    setBusy(true);
    setDialogError(null);
    try {
      if (target.isActive) await doctorsService.deactivate(target.idDoctor);
      else await doctorsService.reactivate(target.idDoctor);
      setTarget(null);
      setSuccess('Estado del médico actualizado.');
      setRefresh((value) => value + 1);
    } catch (failure) {
      setDialogError(getApiErrorMessage(failure));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!canList) return <Alert severity='warning'>No tienes permiso para consultar médicos.</Alert>;
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction='row' justifyContent='space-between' alignItems='center'>
            <Typography variant='h5'>Médicos especialistas</Typography>
            {hasPermission('doctor.create') && (
              <Button component={Link} href='/dashboard/doctors/register' variant='contained'>
                Registrar médico
              </Button>
            )}
          </Stack>
          {error && (
            <Alert
              severity='error'
              action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>}
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity='success' onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          <Box
            component='form'
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              setQuery((current) => ({ ...current, page: 1, search: search.trim() }));
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label='Buscar médicos'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                inputProps={{ maxLength: 200 }}
              />
              <TextField
                select
                label='Estado del perfil'
                value={query.status}
                sx={{ minWidth: 180 }}
                onChange={(event) =>
                  setQuery((current) => ({ ...current, page: 1, status: event.target.value as DoctorsQuery['status'] }))
                }
              >
                <MenuItem value='all'>Todos</MenuItem>
                <MenuItem value='active'>Activos disponibles</MenuItem>
                <MenuItem value='inactive'>Inactivos</MenuItem>
              </TextField>
              <Button type='submit'>Buscar</Button>
            </Stack>
          </Box>
          {loading ? (
            <CircularProgress aria-label='Cargando médicos' />
          ) : (
            page && (
              <>
                <div className='overflow-x-auto'>
                  <table className={tableStyles.table}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Correo</th>
                        <th>Documento</th>
                        <th>Especialidades</th>
                        <th>Perfil</th>
                        <th>Cuenta</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.data.map((doctor) => (
                        <tr key={doctor.idDoctor}>
                          <td>
                            {doctor.user.name} {doctor.user.lastname}
                          </td>
                          <td>{doctor.user.email}</td>
                          <td>{doctor.user.ci}</td>
                          <td>
                            {doctor.specialties
                              .map(({ name, isActive }) => name + (isActive ? '' : ' (inactiva)'))
                              .join(', ') || 'Sin especialidades'}
                          </td>
                          <td>{doctor.isActive ? 'Activo' : 'Inactivo'}</td>
                          <td>{doctor.user.isActive ? 'Activa' : 'Inactiva'}</td>
                          <td>
                            {hasPermission('doctor.assign-specialties') && hasPermission('specialty.get-all') && (
                              <Button onClick={() => setSpecialtiesTarget(doctor.idDoctor)}>
                                Asignar especialidades
                              </Button>
                            )}
                            {hasPermission(doctor.isActive ? 'doctor.delete' : 'doctor.reactivate') && (
                              <Button
                                disabled={busy || (!doctor.isActive && !doctor.user.isActive)}
                                onClick={() => {
                                  setDialogError(null);
                                  setTarget(doctor);
                                }}
                              >
                                {doctor.isActive ? 'Desactivar' : 'Activar'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {page.data.length === 0 && <Typography>No se encontraron médicos.</Typography>}
                <ListPagination
                  query={query}
                  meta={page.meta}
                  onChange={(pagination) => setQuery((current) => ({ ...current, ...pagination }))}
                  labelRowsPerPage='Médicos por página'
                />
              </>
            )
          )}
        </Stack>
      </CardContent>
      {specialtiesTarget !== null && (
        <DoctorSpecialtiesDialog
          key={specialtiesTarget}
          idDoctor={specialtiesTarget}
          onClose={() => setSpecialtiesTarget(null)}
          onSaved={() => {
            setSpecialtiesTarget(null);
            setSuccess('Especialidades del médico actualizadas.');
            setRefresh((value) => value + 1);
          }}
        />
      )}
      <Dialog
        open={target !== null}
        onClose={() => {
          if (!busy) setTarget(null);
        }}
      >
        <DialogTitle>{target?.isActive ? 'Desactivar médico' : 'Activar médico'}</DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity='error'>{dialogError}</Alert>}
          <Typography>
            ¿Deseas {target?.isActive ? 'desactivar' : 'activar'} a {target?.user.name} {target?.user.lastname}?
          </Typography>
          <Typography>
            El perfil y sus asociaciones se conservarán. Un perfil inactivo no estará disponible para nuevos procesos
            médicos.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setTarget(null)}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => void changeStatus()}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
