import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RolePermissionsAdministration from './RolePermissionsAdministration';
import type ListPagination from '@/components/pagination/ListPagination';

import type { Permission, PermissionsQuery, RolePermissions } from '@/types/permissions';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  saving: { current: false },
  denied: new Set<string>(),
  buttons: new Map<string, { disabled?: boolean; onClick?: () => void }>(),
  checkboxes: new Map<
    string,
    { disabled?: boolean; checked?: boolean; onChange?: (event: unknown, checked: boolean) => void }
  >(),
  changeRole: null as ((event: { target: { value: string } }) => void) | null,
  pagination: null as ComponentProps<typeof ListPagination> | null,
  list: vi.fn(),
  getPermissions: vi.fn(),
  replacePermissions: vi.fn(),
  listPage: vi.fn(),
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 11) return [initial, vi.fn()];
      if (!(index in mocks.states)) mocks.states[index] = initial;
      return [
        mocks.states[index],
        (value: unknown) => {
          mocks.states[index] =
            typeof value === 'function' ? (value as (current: unknown) => unknown)(mocks.states[index]) : value;
        },
      ];
    },
    useEffect: (effect: () => void | (() => void)) => {
      if (mocks.effects.length < 3) mocks.effects.push(effect);
    },
    useRef: actual.useRef,
  };
});
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof MuiModule>();
  return {
    ...actual,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (typeof props.children === 'string')
        mocks.buttons.set(props.children, { disabled: props.disabled, onClick: props.onClick as () => void });
      return <actual.Button {...props} />;
    },
    TextField: (props: ComponentProps<typeof actual.TextField>) => {
      if (props.label === 'Rol') mocks.changeRole = props.onChange as typeof mocks.changeRole;
      return <actual.TextField {...props} />;
    },
    Checkbox: (props: ComponentProps<typeof actual.Checkbox>) => {
      mocks.checkboxes.set(props.inputProps?.['aria-label'] as string, {
        disabled: props.disabled,
        checked: props.checked,
        onChange: props.onChange as (event: unknown, checked: boolean) => void,
      });
      return <actual.Checkbox {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ hasPermission: (name: string) => !mocks.denied.has(name) }),
}));
vi.mock('@/services/roles/rolesService', () => ({
  rolesService: {
    list: mocks.list,
    getPermissions: mocks.getPermissions,
    replacePermissions: mocks.replacePermissions,
  },
}));
vi.mock('@/services/permissions/permissionsService', () => ({ permissionsService: { listPage: mocks.listPage } }));
vi.mock('@/components/pagination/ListPagination', async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof ListPagination }>();
  return {
    default: (props: ComponentProps<typeof ListPagination>) => {
      mocks.pagination = props;
      return <actual.default {...props} />;
    },
  };
});

const read: Permission = { idPermission: 1, name: 'user.get-all', description: null, isActive: true };
const create: Permission = {
  idPermission: 2,
  name: 'user.create',
  description: 'Creación de usuarios',
  isActive: true,
};
const role: RolePermissions = { idRole: 1, name: 'SUPERADMIN', isActive: true, permissions: [read] };
const query: PermissionsQuery = { page: 1, limit: 10, status: 'all' };
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  mocks.checkboxes.clear();
  return renderToStaticMarkup(<RolePermissionsAdministration />);
}
async function flush() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.pagination = null;
  mocks.states = [
    [role],
    1,
    role,
    [read.name],
    query,
    { data: [read, create], meta: { ...query, total: 27, totalPages: 3 } },
    query,
    null,
    null,
    false,
    0,
  ];
  mocks.list.mockResolvedValue([role]);
  mocks.getPermissions.mockResolvedValue(role);
  mocks.listPage.mockResolvedValue({ data: [read, create], meta: { ...query, total: 27, totalPages: 3 } });
});

describe('Role permission administration interactions', () => {
  it('shows assigned and available catalog permissions with Spanish labels and intact codes', () => {
    const html = render();
    for (const text of [
      'SUPERADMIN',
      'Usuarios',
      'Consultar listado',
      'Crear',
      'user.get-all',
      'user.create',
      'Asignado',
      'No asignado',
      'Disponible',
      '27',
    ])
      expect(html).toContain(text);
    expect(mocks.checkboxes.get('Seleccionar user.get-all')?.checked).toBe(true);
    expect(mocks.checkboxes.get('Seleccionar user.create')?.checked).toBe(false);
    expect(html).not.toContain('Crear permiso');
  });

  it('loads real role associations and the backend catalog and ignores stale role requests', async () => {
    mocks.states[2] = null;
    render();
    const cleanups = mocks.effects.map((effect) => effect());
    await flush();
    expect(mocks.listPage).toHaveBeenCalledWith(query);
    expect(mocks.getPermissions).toHaveBeenCalledWith(1);
    expect(mocks.states[3]).toEqual([read.name]);
    let resolve!: (value: RolePermissions) => void;
    mocks.getPermissions.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render();
    const cancel = mocks.effects[2]();
    cancel?.();
    resolve({ ...role, idRole: 2, permissions: [] });
    await flush();
    expect((mocks.states[2] as RolePermissions).idRole).toBe(1);
    cleanups.forEach((cleanup) => cleanup?.());
  });

  it('saves multiple assignment and withdrawal changes in one request and immediately reflects persistence', async () => {
    render();
    mocks.checkboxes.get('Seleccionar user.get-all')?.onChange?.({}, false);
    mocks.checkboxes.get('Seleccionar user.create')?.onChange?.({}, true);
    mocks.replacePermissions.mockResolvedValueOnce({ ...role, permissions: [create] });
    render();
    mocks.buttons.get('Guardar permisos')?.onClick?.();
    await flush();
    expect(mocks.replacePermissions).toHaveBeenCalledWith(1, ['user.create']);
    expect(mocks.states[2]).toEqual({ ...role, permissions: [create] });
    expect(render()).toContain('Permisos guardados correctamente');
    expect(mocks.buttons.get('Guardar permisos')?.disabled).toBe(true);
  });

  it('prevents double submission and preserves selected changes when saving fails', async () => {
    mocks.states[3] = [];
    let reject!: (error: Error) => void;
    mocks.replacePermissions.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render();
    const click = mocks.buttons.get('Guardar permisos')?.onClick;
    click?.();
    click?.();
    expect(mocks.replacePermissions).toHaveBeenCalledTimes(1);
    expect(render()).toContain('Guardando');
    expect(mocks.pagination?.disabled).toBe(true);
    reject(new Error('Failure'));
    await flush();
    expect(mocks.states[3]).toEqual([]);
    expect(mocks.states[7]).toBeTruthy();
    expect((mocks.states[2] as RolePermissions).permissions).toEqual([read]);
  });

  it('preserves selection across common pagination and page-size changes, with loading and empty states', async () => {
    mocks.states[3] = [read.name, create.name];
    render();
    mocks.pagination?.onChange({ page: 2, limit: 25 });
    expect(mocks.states[4]).toEqual({ page: 2, limit: 25, status: 'all' });
    expect(render()).toContain('Cargando catálogo de permisos');
    mocks.listPage.mockResolvedValueOnce({ data: [], meta: { page: 2, limit: 25, total: 27, totalPages: 2 } });
    mocks.effects[1]();
    await flush();
    expect(mocks.listPage).toHaveBeenLastCalledWith({ page: 2, limit: 25, status: 'all' });
    expect(mocks.states[3]).toEqual([read.name, create.name]);
    expect(render()).toContain('No se encontraron permisos');
  });

  it('enforces read-only UI and handler checks, inactive roles and inactive catalog permissions', () => {
    mocks.denied.add('role.assign-permissions');
    expect(render()).not.toContain('Guardar permisos');
    const control = mocks.checkboxes.get('Seleccionar user.create');
    expect(control?.disabled).toBe(true);
    control?.onChange?.({}, true);
    expect(mocks.states[3]).toEqual([read.name]);
    mocks.denied.clear();
    mocks.states[2] = { ...role, isActive: false };
    expect(render()).toContain('Reactiva el rol');
    expect(mocks.checkboxes.get('Seleccionar user.create')?.disabled).toBe(true);
    mocks.states[2] = role;
    mocks.states[5] = { data: [{ ...create, isActive: false }], meta: { ...query, total: 1, totalPages: 1 } };
    render();
    expect(mocks.checkboxes.get('Seleccionar user.create')?.disabled).toBe(true);
    mocks.denied.add('permission.get-all');
    expect(render()).toContain('No tienes permiso para consultar');
    mocks.effects.forEach((effect) => effect());
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('selects a different role and discards prior pending state before fetching its actual assignments', async () => {
    render();
    mocks.changeRole?.({ target: { value: '2' } });
    expect(mocks.states[1]).toBe(2);
    expect(mocks.states[2]).toBeNull();
    expect(mocks.states[3]).toEqual([]);
    const next = { ...role, idRole: 2, name: 'STAFF', permissions: [] };
    mocks.getPermissions.mockResolvedValueOnce(next);
    expect(render()).toContain('Cargando permisos del rol');
    mocks.effects[2]();
    await flush();
    expect(mocks.getPermissions).toHaveBeenLastCalledWith(2);
    expect(render()).toContain('Este rol no tiene permisos asignados');
  });
});
