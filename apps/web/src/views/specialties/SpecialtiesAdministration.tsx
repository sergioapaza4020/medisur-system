'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { specialtiesService } from '@/services/specialties/specialtiesService';
import type { Specialty, SpecialtyWrite, SpecialtiesPage, SpecialtiesQuery } from '@/types/specialties';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { formatSpecialtyName } from '@/utils/specialtyName';
import tableStyles from '@core/styles/table.module.css';

const emptyForm: SpecialtyWrite = { name: '' };

export function SpecialtyActions({
  specialty,
  hasPermission,
  onEdit,
  onStatus,
}: {
  specialty: Specialty;
  hasPermission: (permission: string) => boolean;
  onEdit: () => void;
  onStatus: () => void;
}) {
  return (
    <Stack direction='row' spacing={1}>
      {hasPermission('specialty.update') && <Button onClick={onEdit}>Editar</Button>}
      {hasPermission(specialty.isActive ? 'specialty.delete' : 'specialty.reactivate') && (
        <Button
          color={specialty.isActive ? 'warning' : 'success'}
          onClick={() => {
            onStatus();
          }}
        >
          {specialty.isActive ? 'Desactivar' : 'Activar'}
        </Button>
      )}
    </Stack>
  );
}

export default function SpecialtiesAdministration() {
  const { hasPermission } = useAuth();
  const canList = hasPermission('specialty.get-all');
  const [query, setQuery] = useState<SpecialtiesQuery>({ page: 1, limit: 10, status: 'all', search: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<SpecialtiesPage | null>(null);
  const [completed, setCompleted] = useState<{ query: SpecialtiesQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editor, setEditor] = useState<Specialty | 'create' | null>(null);
  const [form, setForm] = useState<SpecialtyWrite>(emptyForm);
  const [statusSpecialty, setStatusSpecialty] = useState<Specialty | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const loading = completed?.query !== query || completed?.refresh !== refresh;

  useEffect(() => {
    if (!canList) return;
    let active = true;

    specialtiesService
      .listPage(query)
      .then((result) => {
        if (!active) return;
        setError(null);
        if (query.page > 1 && query.page > Math.max(1, result.meta.totalPages))
          setQuery((current) => ({ ...current, page: Math.max(1, result.meta.totalPages) }));
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

  function openEditor(specialty?: Specialty) {
    setDialogError(null);
    setForm(specialty ? { name: specialty.name } : emptyForm);
    setEditor(specialty ?? 'create');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = formatSpecialtyName(form.name);
    if (
      !editor ||
      busy ||
      !name ||
      name.length > 100 ||
      !hasPermission(editor === 'create' ? 'specialty.create' : 'specialty.update')
    )
      return;
    setBusy(true);
    setDialogError(null);
    try {
      if (editor === 'create') await specialtiesService.create({ name });
      else await specialtiesService.update(editor.idSpecialty, { name });
      setEditor(null);
      setForm(emptyForm);
      setSuccess('Especialidad guardada correctamente.');
      setRefresh((value) => value + 1);
    } catch (failure) {
      setDialogError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus() {
    if (
      !statusSpecialty ||
      busy ||
      !hasPermission(statusSpecialty.isActive ? 'specialty.delete' : 'specialty.reactivate')
    )
      return;
    setBusy(true);
    setDialogError(null);
    try {
      if (statusSpecialty.isActive) await specialtiesService.deactivate(statusSpecialty.idSpecialty);
      else await specialtiesService.reactivate(statusSpecialty.idSpecialty);
      setStatusSpecialty(null);
      setSuccess('Estado de la especialidad actualizado.');
      setRefresh((value) => value + 1);
    } catch (failure) {
      setDialogError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!canList) return <Alert severity='warning'>No tienes permiso para consultar especialidades.</Alert>;

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction='row' alignItems='center' justifyContent='space-between'>
            <Typography variant='h5'>Especialidades médicas</Typography>
            {hasPermission('specialty.create') && (
              <Button variant='contained' onClick={() => openEditor()}>
                Crear especialidad
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
                label='Buscar especialidades'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
                inputProps={{ maxLength: 200 }}
              />
              <TextField
                select
                label='Estado'
                value={query.status}
                sx={{ minWidth: 150 }}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    page: 1,
                    status: event.target.value as SpecialtiesQuery['status'],
                  }))
                }
              >
                <MenuItem value='all'>Todos</MenuItem>
                <MenuItem value='active'>Activas</MenuItem>
                <MenuItem value='inactive'>Inactivas</MenuItem>
              </TextField>
              <Button type='submit' variant='outlined'>
                Buscar
              </Button>
            </Stack>
          </Box>
          {loading ? (
            <CircularProgress aria-label='Cargando especialidades' />
          ) : (
            page && (
              <>
                <div className='overflow-x-auto'>
                  <table className={tableStyles.table}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Estado</th>

                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.data.map((specialty) => (
                        <tr key={specialty.idSpecialty}>
                          <td>{specialty.name}</td>
                          <td>
                            <Chip
                              size='small'
                              variant='tonal'
                              label={specialty.isActive ? 'Activo' : 'Inactivo'}
                              color={specialty.isActive ? 'success' : 'secondary'}
                            />
                          </td>

                          <td>
                            <SpecialtyActions
                              specialty={specialty}
                              hasPermission={hasPermission}
                              onEdit={() => openEditor(specialty)}
                              onStatus={() => {
                                setDialogError(null);
                                setStatusSpecialty(specialty);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {page.data.length === 0 && <Typography>No se encontraron especialidades.</Typography>}
                <ListPagination
                  query={query}
                  meta={page.meta}
                  onChange={(pagination) => setQuery((current) => ({ ...current, ...pagination }))}
                  labelRowsPerPage='Especialidades por página'
                />
              </>
            )
          )}
        </Stack>
      </CardContent>
      <Dialog
        open={editor !== null}
        onClose={() => {
          if (!busy) setEditor(null);
        }}
        fullWidth
        maxWidth='sm'
      >
        <Box component='form' onSubmit={save}>
          <DialogTitle>{editor === 'create' ? 'Crear especialidad' : 'Editar especialidad'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ pt: 2 }}>
              {dialogError && <Alert severity='error'>{dialogError}</Alert>}
              <TextField
                label='Nombre'
                name='name'
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                disabled={busy}
                inputProps={{ maxLength: 100 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setEditor(null)}>
              Cancelar
            </Button>
            <Button disabled={busy || !form.name.trim()} variant='contained' type='submit'>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={statusSpecialty !== null}
        onClose={() => {
          if (!busy) setStatusSpecialty(null);
        }}
      >
        <DialogTitle>{statusSpecialty?.isActive ? 'Desactivar especialidad' : 'Activar especialidad'}</DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity='error'>{dialogError}</Alert>}
          <Typography>
            ¿Deseas {statusSpecialty?.isActive ? 'desactivar' : 'activar'} la especialidad {statusSpecialty?.name}?
          </Typography>
          {statusSpecialty?.isActive && (
            <Typography>
              El registro se conservará para mantener el historial. No estará disponible en nuevos procesos mientras
              esté inactiva.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setStatusSpecialty(null)}>
            Cancelar
          </Button>
          <Button disabled={busy} variant='contained' onClick={() => void changeStatus()}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
