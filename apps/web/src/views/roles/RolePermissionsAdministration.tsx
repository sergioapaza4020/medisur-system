'use client';

import { Fragment, useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import ListPagination from '@/components/pagination/ListPagination';
import { permissionsService } from '@/services/permissions/permissionsService';
import { rolesService } from '@/services/roles/rolesService';
import type { RoleOption } from '@/services/roles/rolesService';
import type { PermissionsPage, PermissionsQuery, RolePermissions } from '@/types/permissions';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { getPermissionDomain, getPermissionLabel } from '@/utils/permissionLabels';
import { getRoleLabel } from '@/utils/roleLabels';
import tableStyles from '@core/styles/table.module.css';

export default function RolePermissionsAdministration() {
  const { hasPermission } = useAuth();
  const canRead = ['role.get-all', 'role.get-one-by-id', 'permission.get-all'].every(hasPermission);
  const canAssign = hasPermission('role.assign-permissions');
  const [roles, setRoles] = useState<RoleOption[] | null>(null);
  const [roleId, setRoleId] = useState<number | ''>('');
  const [role, setRole] = useState<RolePermissions | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState<PermissionsQuery>({ page: 1, limit: 10, status: 'all' });
  const [catalog, setCatalog] = useState<PermissionsPage | null>(null);
  const [completed, setCompleted] = useState<PermissionsQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const saving = useRef(false);
  const loadingCatalog = completed !== query;
  const loadingRole = roleId !== '' && role?.idRole !== roleId;
  const assigned = new Set(role?.permissions.map((permission) => permission.name));
  const changed = selected.length !== assigned.size || selected.some((name) => !assigned.has(name));

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    rolesService
      .list()
      .then((result) => {
        if (active) {
          setRoles(result);
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(getApiErrorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [canRead, refresh]);

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    permissionsService
      .listPage(query)
      .then((result) => {
        if (!active) return;
        if (query.page > Math.max(1, result.meta.totalPages))
          setQuery((current) => ({ ...current, page: Math.max(1, result.meta.totalPages) }));
        else setCatalog(result);
      })
      .catch((failure: unknown) => {
        if (active) {
          setCatalog(null);
          setError(getApiErrorMessage(failure));
        }
      })
      .finally(() => {
        if (active) setCompleted(query);
      });
    return () => {
      active = false;
    };
  }, [canRead, query, refresh]);

  useEffect(() => {
    if (!canRead || roleId === '') return;
    let active = true;
    rolesService
      .getPermissions(roleId)
      .then((result) => {
        if (active) {
          setRole(result);
          setSelected(result.permissions.map((permission) => permission.name));
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(getApiErrorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [canRead, roleId, refresh]);

  async function save() {
    if (saving.current || !canAssign || !role?.isActive || role.idRole !== roleId || !changed) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await rolesService.replacePermissions(role.idRole, selected);
      setRole(result);
      setSelected(result.permissions.map((permission) => permission.name));
      setSuccess('Permisos guardados correctamente. Los cambios se aplican a la autorización de los usuarios.');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!canRead) return <Alert severity='warning'>No tienes permiso para consultar los permisos de los roles.</Alert>;

  const groups = [...new Set(catalog?.data.map((permission) => getPermissionDomain(permission.name)))];

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant='h5'>Permisos por rol</Typography>
          <Typography>
            Selecciona un rol y guarda los cambios de sus permisos. Los códigos proceden del catálogo del sistema.
          </Typography>
          {error && (
            <Alert
              severity='error'
              action={
                <Button
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setRefresh((value) => value + 1);
                  }}
                >
                  Reintentar
                </Button>
              }
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity='success' onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          {!roles && !error && <CircularProgress aria-label='Cargando roles' />}
          <TextField
            select
            label='Rol'
            value={roleId}
            disabled={busy || !roles}
            onChange={(event) => {
              setRoleId(Number(event.target.value));
              setRole(null);
              setSelected([]);
              setError(null);
              setSuccess(null);
            }}
          >
            {roles?.map((option) => (
              <MenuItem key={option.idRole} value={option.idRole}>
                {getRoleLabel(option.name)} ({option.name}){!option.isActive ? ' — Inactivo' : ''}
              </MenuItem>
            ))}
          </TextField>
          {roles?.length === 0 && <Typography>No se encontraron roles.</Typography>}
          {loadingRole && !error && <CircularProgress aria-label='Cargando permisos del rol' />}
          {role?.idRole === roleId && (
            <>
              {!role.isActive && (
                <Alert severity='info'>
                  Reactiva el rol para modificar sus permisos. Sus asociaciones se conservan.
                </Alert>
              )}
              <Typography>
                Permisos asignados: {role.permissions.length}. Seleccionados para guardar: {selected.length}.
              </Typography>
              <Stack direction='row' useFlexGap flexWrap='wrap' gap={1}>
                {role.permissions.map((permission) => (
                  <Chip
                    key={permission.idPermission}
                    label={`${getPermissionDomain(permission.name)}: ${getPermissionLabel(permission.name)} (${permission.name})${!permission.isActive ? ' — Inactivo' : ''}`}
                  />
                ))}
              </Stack>
              {role.permissions.length === 0 && <Typography>Este rol no tiene permisos asignados.</Typography>}
              {loadingCatalog ? (
                <CircularProgress aria-label='Cargando catálogo de permisos' />
              ) : (
                catalog && (
                  <>
                    <div className='overflow-x-auto'>
                      <table className={tableStyles.table}>
                        <thead>
                          <tr>
                            <th>Seleccionar</th>
                            <th>Permiso</th>
                            <th>Código interno</th>
                            <th>Asignación actual</th>
                            <th>Disponibilidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groups.map((domain) => (
                            <Fragment key={domain}>
                              <tr>
                                <th colSpan={5}>{domain}</th>
                              </tr>
                              {catalog.data
                                .filter((permission) => getPermissionDomain(permission.name) === domain)
                                .map((permission) => (
                                  <tr key={permission.idPermission}>
                                    <td>
                                      <Checkbox
                                        checked={selected.includes(permission.name)}
                                        disabled={
                                          busy ||
                                          !canAssign ||
                                          !role.isActive ||
                                          (!permission.isActive && !assigned.has(permission.name))
                                        }
                                        inputProps={{ 'aria-label': `Seleccionar ${permission.name}` }}
                                        onChange={(_, checked) => {
                                          if (
                                            !canAssign ||
                                            busy ||
                                            !role.isActive ||
                                            (!permission.isActive && !assigned.has(permission.name))
                                          )
                                            return;
                                          setSelected((current) =>
                                            checked
                                              ? [...new Set([...current, permission.name])]
                                              : current.filter((name) => name !== permission.name),
                                          );
                                          setSuccess(null);
                                        }}
                                      />
                                    </td>
                                    <td>
                                      <Typography>{getPermissionLabel(permission.name)}</Typography>
                                      {permission.description && (
                                        <Typography variant='body2'>{permission.description}</Typography>
                                      )}
                                    </td>
                                    <td>{permission.name}</td>
                                    <td>{assigned.has(permission.name) ? 'Asignado' : 'No asignado'}</td>
                                    <td>{permission.isActive ? 'Disponible' : 'Inactivo'}</td>
                                  </tr>
                                ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {catalog.data.length === 0 && <Typography>No se encontraron permisos.</Typography>}
                    <ListPagination
                      query={query}
                      meta={catalog.meta}
                      disabled={busy}
                      onChange={(pagination) => setQuery((current) => ({ ...current, ...pagination }))}
                      labelRowsPerPage='Permisos por página'
                    />
                  </>
                )
              )}
              {canAssign && (
                <Stack direction='row' spacing={2}>
                  <Button
                    variant='contained'
                    disabled={busy || !role.isActive || loadingCatalog || !catalog || !changed}
                    onClick={() => void save()}
                  >
                    {busy ? 'Guardando…' : 'Guardar permisos'}
                  </Button>
                  <Button
                    disabled={busy || !changed}
                    onClick={() => {
                      setSelected(role.permissions.map((permission) => permission.name));
                      setSuccess(null);
                    }}
                  >
                    Descartar cambios
                  </Button>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
