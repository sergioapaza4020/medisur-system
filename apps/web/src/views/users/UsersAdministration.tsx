'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  Alert,
  Autocomplete,
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
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { rolesService } from '@/services/roles/rolesService';
import { usersService } from '@/services/users/usersService';
import type { AdministrativeUser, CreateUser, UserFields, UsersPage, UsersQuery } from '@/types/users';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { getRoleLabel } from '@/utils/roleLabels';
import tableStyles from '@core/styles/table.module.css';

const emptyForm: UserFields = { email: '', name: '', lastname: '', ci: '' };
const labels = {
  email: 'Correo',
  name: 'Nombre',
  lastname: 'Apellido',
  ci: 'Documento de identidad',
};

export function UserActions({
  user,
  authenticatedUserId,
  hasPermission,
  onDetail,
  onEdit,
  onStatus,
}: {
  user: AdministrativeUser;
  authenticatedUserId: number | undefined;
  hasPermission: (permission: string) => boolean;
  onDetail: () => void;
  onEdit: () => void;
  onStatus: () => void;
}) {
  const isSelfDeactivation = user.isActive && user.idUser === authenticatedUserId;
  return (
    <Stack direction='row' spacing={1}>
      {hasPermission('user.get-one-by-id') && <Button onClick={onDetail}>Ver</Button>}
      {hasPermission('user.update') && <Button onClick={onEdit}>Editar</Button>}
      {hasPermission(user.isActive ? 'user.delete' : 'user.reactivate') && (
        <Tooltip title={isSelfDeactivation ? 'Tu propia cuenta no puede ser desactivada.' : ''}>
          <span>
            <Button
              color={user.isActive ? 'warning' : 'success'}
              disabled={isSelfDeactivation}
              onClick={() => {
                if (!isSelfDeactivation) onStatus();
              }}
            >
              {user.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </span>
        </Tooltip>
      )}
    </Stack>
  );
}

export default function UsersAdministration() {
  const { user: authenticatedUser, hasPermission } = useAuth();
  const canList = hasPermission('user.get-all');
  const canCreate = hasPermission('user.create') && hasPermission('user.assign-roles');
  const canReadRoles = hasPermission('role.get-all');
  const canAssignRoles = hasPermission('user.assign-roles');
  const [query, setQuery] = useState<UsersQuery>({ page: 1, limit: 10, status: 'all', search: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<UsersPage | null>(null);
  const [completed, setCompleted] = useState<{ query: UsersQuery; refresh: number } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ id?: number; roleNames?: string[] } | null>(null);
  const [form, setForm] = useState<(UserFields & { roleNames?: string[] }) | CreateUser>(emptyForm);
  const [roles, setRoles] = useState<string[]>([]);
  const [detail, setDetail] = useState<AdministrativeUser | null>(null);
  const [statusUser, setStatusUser] = useState<AdministrativeUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const loading = completed?.query !== query || completed?.refresh !== refresh;
  const selectedRoleNames = [
    ...new Set((form.roleNames ?? []).map((role) => role.trim().toUpperCase()).filter(Boolean)),
  ];
  const rolesMissing = selectedRoleNames.length === 0;

  function applySearch(value: string) {
    const normalized = value.trim() || undefined;
    setQuery((current) =>
      current.page === 1 && (current.search || undefined) === normalized
        ? current
        : { ...current, page: 1, search: normalized },
    );
  }

  useEffect(() => {
    if (!canList) return;
    let active = true;

    usersService
      .list(query)
      .then((result) => {
        if (!active) return;
        setError(null);
        if (query.page > 1 && query.page > Math.max(1, result.meta.totalPages)) {
          setQuery((current) => ({ ...current, page: Math.max(1, result.meta.totalPages) }));
        } else setPage(result);
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

  useEffect(() => {
    if (!editor || !canReadRoles || !canAssignRoles) return;
    let active = true;

    rolesService
      .list()
      .then((result) => {
        if (active) setRoles(result.filter((role) => role.isActive).map((role) => role.name));
      })
      .catch((failure: unknown) => {
        if (active) setDialogError(getApiErrorMessage(failure));
      });

    return () => {
      active = false;
    };
  }, [editor, canReadRoles, canAssignRoles]);

  function openEditor(user?: AdministrativeUser) {
    setDialogError(null);
    setForm(
      user
        ? {
            email: user.email,
            name: user.name,
            lastname: user.lastname,
            ci: user.ci,
            roleNames: user.roles.map((role) => role.name),
          }
        : { ...emptyForm, password: '', roleNames: [] },
    );
    setEditor(user ? { id: user.idUser, roleNames: user.roles.map((role) => role.name) } : {});
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy || (editor.id === undefined ? !canCreate : !hasPermission('user.update'))) return;
    if (rolesMissing) {
      setDialogError('El usuario debe tener al menos un rol');
      return;
    }
    setBusy(true);
    setDialogError(null);
    let repairedRoles = false;
    try {
      const { email, name, lastname, ci } = form;
      const fields = { email: email.trim().toLowerCase(), name, lastname, ci };
      if (editor.id === undefined && 'password' in form)
        await usersService.create({
          ...fields,
          password: form.password,
          roleNames: selectedRoleNames,
        });
      else if (editor.id !== undefined) {
        const original = editor.roleNames ?? [];
        // Repair legacy accounts before the administrative update validates their roles.
        if (!original.length && canAssignRoles) {
          await usersService.replaceRoles(editor.id, selectedRoleNames);
          repairedRoles = true;
          setEditor({ ...editor, roleNames: selectedRoleNames });
        }
        await usersService.update(editor.id, fields);
        const roleNames = selectedRoleNames;
        if (
          canAssignRoles &&
          original.length > 0 &&
          (roleNames.length !== original.length || roleNames.some((role) => !original.includes(role)))
        ) {
          try {
            await usersService.replaceRoles(editor.id, roleNames);
          } catch (failure) {
            setRefresh((value) => value + 1);
            setDialogError(`Los datos del usuario se guardaron, pero los roles no: ${getApiErrorMessage(failure)}`);
            return;
          }
        }
      }
      setEditor(null);
      setForm(emptyForm);
      setSuccess('Usuario guardado correctamente.');
      setRefresh((value) => value + 1);
    } catch (failure) {
      if (repairedRoles) {
        setRefresh((value) => value + 1);
        setDialogError(`Los roles del usuario se guardaron, pero los datos no: ${getApiErrorMessage(failure)}`);
      } else setDialogError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function viewUser(user: AdministrativeUser) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await usersService.get(user.idUser));
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus() {
    if (!statusUser || busy || !hasPermission(statusUser.isActive ? 'user.delete' : 'user.reactivate')) return;
    if (statusUser.isActive && statusUser.idUser === authenticatedUser?.idUser) return;
    setBusy(true);
    setDialogError(null);
    try {
      if (statusUser.isActive) await usersService.deactivate(statusUser.idUser);
      else await usersService.reactivate(statusUser.idUser);
      setStatusUser(null);
      setSuccess('Estado de la cuenta actualizado.');
      setRefresh((value) => value + 1);
    } catch (failure) {
      setDialogError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!canList) return <Alert severity='warning'>No tienes permiso para consultar usuarios.</Alert>;

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction='row' justifyContent='space-between' alignItems='center'>
            <Typography variant='h5'>Usuarios de MEDISUR</Typography>
            {canCreate && (
              <Button variant='contained' onClick={() => openEditor()}>
                Crear usuario
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
              applySearch(search);
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label='Buscar usuarios'
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                  if (!value.trim()) applySearch('');
                }}
                inputProps={{ maxLength: 200 }}
                InputProps={{
                  endAdornment: search ? (
                    <InputAdornment position='end'>
                      <IconButton
                        type='button'
                        edge='end'
                        aria-label='Limpiar búsqueda'
                        onClick={() => {
                          setSearch('');
                          applySearch('');
                        }}
                      >
                        <i aria-hidden='true' className='ri-close-line' />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                fullWidth
              />
              <TextField
                select
                label='Estado'
                value={query.status}
                onChange={(event) =>
                  setQuery((current) => ({ ...current, page: 1, status: event.target.value as UsersQuery['status'] }))
                }
                sx={{ minWidth: 150 }}
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
            <CircularProgress aria-label='Cargando usuarios' />
          ) : (
            page && (
              <>
                <div className='overflow-x-auto'>
                  <table className={tableStyles.table}>
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Correo</th>
                        <th>Roles</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.data.map((user) => (
                        <tr key={user.idUser}>
                          <td>
                            <Typography>
                              {user.name} {user.lastname}
                            </Typography>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            {user.roles
                              .filter((role) => role.isActive)
                              .map((role) => getRoleLabel(role.name))
                              .join(', ') || 'Sin rol activo'}
                          </td>
                          <td>
                            <Chip
                              variant='tonal'
                              size='small'
                              label={user.isActive ? 'Activo' : 'Inactivo'}
                              color={user.isActive ? 'success' : 'secondary'}
                            />
                          </td>
                          <td>
                            <UserActions
                              user={user}
                              authenticatedUserId={authenticatedUser?.idUser}
                              hasPermission={hasPermission}
                              onDetail={() => void viewUser(user)}
                              onEdit={() => openEditor(user)}
                              onStatus={() => {
                                if (user.isActive && user.idUser === authenticatedUser?.idUser) return;
                                setDialogError(null);
                                setStatusUser(user);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {page.data.length === 0 && <Typography>No se encontraron usuarios.</Typography>}
                <ListPagination
                  query={query}
                  meta={page.meta}
                  onChange={(pagination) => setQuery((current) => ({ ...current, ...pagination }))}
                  labelRowsPerPage='Usuarios por página'
                />
              </>
            )
          )}
        </Stack>
      </CardContent>
      <Dialog
        open={editor !== null}
        onClose={() => {
          if (!busy) {
            setEditor(null);
            setForm(emptyForm);
          }
        }}
        fullWidth
        maxWidth='sm'
      >
        <Box component='form' onSubmit={save}>
          <DialogTitle>{editor?.id === undefined ? 'Crear usuario' : 'Editar usuario'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ pt: 2 }}>
              {dialogError && <Alert severity='error'>{dialogError}</Alert>}
              {(Object.keys(labels) as (keyof typeof labels)[]).map((field) => (
                <TextField
                  key={field}
                  name={field}
                  label={labels[field]}
                  value={form[field]}
                  onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                  required
                  disabled={busy}
                  type={field === 'email' ? 'email' : 'text'}
                />
              ))}
              {editor?.id === undefined && 'password' in form && (
                <TextField
                  name='password'
                  label='Contraseña'
                  type='password'
                  autoComplete='new-password'
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required
                  disabled={busy}
                />
              )}
              {'roleNames' in form && (
                <Autocomplete
                  multiple
                  freeSolo
                  options={roles}
                  getOptionLabel={getRoleLabel}
                  value={form.roleNames ?? []}
                  onChange={(_, value) => {
                    setForm((current) => ({ ...current, roleNames: value }));
                    setDialogError(null);
                  }}
                  disabled={busy || !canAssignRoles}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label='Roles (obligatorio)'
                      error={rolesMissing}
                      helperText={
                        rolesMissing
                          ? 'El usuario debe tener al menos un rol. Selecciona al menos un rol para este usuario.'
                          : 'Selecciona al menos un rol para este usuario.'
                      }
                    />
                  )}
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              disabled={busy}
              onClick={() => {
                setEditor(null);
                setForm(emptyForm);
              }}
            >
              Cancelar
            </Button>
            <Button type='submit' variant='contained' disabled={busy || rolesMissing}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={detail !== null} onClose={() => setDetail(null)} fullWidth maxWidth='sm'>
        <DialogTitle>Información del usuario</DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={2}>
              {(Object.keys(labels) as (keyof typeof labels)[]).map((field) => (
                <Typography key={field}>
                  <strong>{labels[field]}:</strong> {detail[field]}
                </Typography>
              ))}
              <Typography>Estado: {detail.isActive ? 'Activo' : 'Inactivo'}</Typography>
              <Typography>
                Roles:{' '}
                {detail.roles
                  .map((role) => `${getRoleLabel(role.name)}${role.isActive ? '' : ' (inactivo)'}`)
                  .join(', ') || 'Sin roles'}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={statusUser !== null}
        onClose={() => {
          if (!busy) setStatusUser(null);
        }}
      >
        <DialogTitle>{statusUser?.isActive ? 'Desactivar cuenta' : 'Activar cuenta'}</DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity='error'>{dialogError}</Alert>}
          <Typography>
            ¿Deseas {statusUser?.isActive ? 'desactivar' : 'activar'} la cuenta de {statusUser?.email}?
          </Typography>
          {statusUser?.isActive && (
            <Typography>La cuenta perderá el acceso a MEDISUR. Su información se conservará.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setStatusUser(null)}>
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
