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
  Tooltip,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { rolesService } from '@/services/roles/rolesService';
import type { AdministrativeRole, CreateRole, RolesPage, RolesQuery } from '@/types/roles';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { getRoleLabel } from '@/utils/roleLabels';
import tableStyles from '@core/styles/table.module.css';

const emptyForm: CreateRole = { name: '', description: '' };

export function RoleActions({
  role,
  hasPermission,
  onEdit,
  onStatus,
}: {
  role: AdministrativeRole;
  hasPermission: (permission: string) => boolean;
  onEdit: () => void;
  onStatus: () => void;
}) {
  const protectedDeactivation = role.isSystem && role.isActive;

  return (
    <Stack direction='row' spacing={1}>
      {hasPermission('role.update') && <Button onClick={onEdit}>Editar</Button>}
      {hasPermission(role.isActive ? 'role.delete' : 'role.reactivate') && (
        <Tooltip title={protectedDeactivation ? 'Los roles base no pueden desactivarse.' : ''}>
          <span>
            <Button
              color={role.isActive ? 'warning' : 'success'}
              disabled={protectedDeactivation}
              onClick={() => {
                if (!protectedDeactivation) onStatus();
              }}
            >
              {role.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </span>
        </Tooltip>
      )}
    </Stack>
  );
}

export default function RolesAdministration() {
  const { hasPermission } = useAuth();
  const canList = hasPermission('role.get-all');
  const [query, setQuery] = useState<RolesQuery>({ page: 1, limit: 10, status: 'all', search: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<RolesPage | null>(null);
  const [completed, setCompleted] = useState<{ query: RolesQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editor, setEditor] = useState<AdministrativeRole | 'create' | null>(null);
  const [form, setForm] = useState<CreateRole>(emptyForm);
  const [statusRole, setStatusRole] = useState<AdministrativeRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const loading = completed?.query !== query || completed?.refresh !== refresh;

  useEffect(() => {
    if (!canList) return;
    let active = true;

    rolesService
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

  function openEditor(role?: AdministrativeRole) {
    setDialogError(null);
    setForm(role ? { name: role.name, description: role.description ?? '' } : emptyForm);
    setEditor(role ?? 'create');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy || !hasPermission(editor === 'create' ? 'role.create' : 'role.update')) return;
    setBusy(true);
    setDialogError(null);
    try {
      if (editor === 'create') await rolesService.create({ name: form.name, description: form.description });
      else await rolesService.update(editor.idRole, { description: form.description });
      setEditor(null);
      setForm(emptyForm);
      setSuccess('Rol guardado correctamente.');
      setRefresh((value) => value + 1);
    } catch (failure) {
      setDialogError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus() {
    if (
      !statusRole ||
      busy ||
      (statusRole.isActive && statusRole.isSystem) ||
      !hasPermission(statusRole.isActive ? 'role.delete' : 'role.reactivate')
    )
      return;
    setBusy(true);
    setDialogError(null);
    try {
      if (statusRole.isActive) await rolesService.deactivate(statusRole.idRole);
      else await rolesService.reactivate(statusRole.idRole);
      setStatusRole(null);
      setSuccess('Estado del rol actualizado.');
      setRefresh((value) => value + 1);
    } catch (failure) {
      setDialogError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!canList) return <Alert severity='warning'>No tienes permiso para consultar roles.</Alert>;

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction='row' alignItems='center' justifyContent='space-between'>
            <Typography variant='h5'>Roles de MEDISUR</Typography>
            {hasPermission('role.create') && (
              <Button variant='contained' onClick={() => openEditor()}>
                Crear rol
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
                label='Buscar roles'
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
                  setQuery((current) => ({ ...current, page: 1, status: event.target.value as RolesQuery['status'] }))
                }
              >
                <MenuItem value='all'>Todos</MenuItem>
                <MenuItem value='active'>Activos</MenuItem>
                <MenuItem value='inactive'>Inactivos</MenuItem>
              </TextField>
              <Button type='submit' variant='outlined'>
                Buscar
              </Button>
            </Stack>
          </Box>
          {loading ? (
            <CircularProgress aria-label='Cargando roles' />
          ) : (
            page && (
              <>
                <div className='overflow-x-auto'>
                  <table className={tableStyles.table}>
                    <thead>
                      <tr>
                        <th>Nombre visible</th>
                        <th>Código interno</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Permisos asociados</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.data.map((role) => (
                        <tr key={role.idRole}>
                          <td>
                            <Typography>{getRoleLabel(role.name)}</Typography>
                            {role.isSystem && <Chip size='small' variant='tonal' label='Rol base' />}
                          </td>
                          <td>{role.name}</td>
                          <td>{role.description || 'Sin descripción'}</td>
                          <td>
                            <Chip
                              size='small'
                              variant='tonal'
                              label={role.isActive ? 'Activo' : 'Inactivo'}
                              color={role.isActive ? 'success' : 'secondary'}
                            />
                          </td>
                          <td>{role.permissionCount}</td>
                          <td>
                            <RoleActions
                              role={role}
                              hasPermission={hasPermission}
                              onEdit={() => openEditor(role)}
                              onStatus={() => {
                                if (role.isActive && role.isSystem) return;
                                setDialogError(null);
                                setStatusRole(role);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {page.data.length === 0 && <Typography>No se encontraron roles.</Typography>}
                <ListPagination
                  query={query}
                  meta={page.meta}
                  onChange={(pagination) => setQuery((current) => ({ ...current, ...pagination }))}
                  labelRowsPerPage='Roles por página'
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
          <DialogTitle>{editor === 'create' ? 'Crear rol' : 'Editar rol'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ pt: 2 }}>
              {dialogError && <Alert severity='error'>{dialogError}</Alert>}
              <TextField
                label='Nombre / código interno'
                name='name'
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                disabled={busy || editor !== 'create'}
                inputProps={{ maxLength: 100 }}
                helperText={
                  editor === 'create'
                    ? 'El código se guarda en mayúsculas y permanecerá fijo.'
                    : 'El código interno se conserva. La traducción es únicamente visual.'
                }
              />
              <TextField
                label='Descripción'
                name='description'
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                multiline
                minRows={3}
                disabled={busy}
                inputProps={{ maxLength: 500 }}
              />
              {editor === 'create' && (
                <Typography variant='body2'>
                  El rol se creará activo y sin permisos. Las capacidades se asignan por separado.
                </Typography>
              )}
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
        open={statusRole !== null}
        onClose={() => {
          if (!busy) setStatusRole(null);
        }}
      >
        <DialogTitle>{statusRole?.isActive ? 'Desactivar rol' : 'Activar rol'}</DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity='error'>{dialogError}</Alert>}
          <Typography>
            ¿Deseas {statusRole?.isActive ? 'desactivar' : 'activar'} el rol {statusRole?.name}?
          </Typography>
          {statusRole?.isActive && (
            <Typography>
              Sus asignaciones se conservarán. Los usuarios dejarán de recibir las capacidades de este rol mientras esté
              inactivo.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setStatusRole(null)}>
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
