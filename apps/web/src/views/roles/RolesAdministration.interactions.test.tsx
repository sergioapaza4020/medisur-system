import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RolesAdministration from './RolesAdministration';
import type ListPagination from '@/components/pagination/ListPagination';

import type { AdministrativeRole, RolesPage, RolesQuery } from '@/types/roles';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effect: null as (() => void | (() => void)) | null,
  fields: new Map<string, { disabled?: boolean; onChange?: (event: { target: { value: string } }) => void }>(),
  buttons: new Map<string, { disabled?: boolean; onClick?: () => void }>(),
  submit: null as (() => Promise<void>) | null,
  pagination: null as ComponentProps<typeof ListPagination> | null,
  denied: new Set<string>(),
  listPage: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 12) return [initial, vi.fn()];
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
      mocks.effect ??= effect;
    },
  };
});
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof MuiModule>();
  return {
    ...actual,
    Dialog: ({ open, children }: ComponentProps<typeof actual.Dialog>) => (open ? <>{children}</> : null),
    Box: (props: ComponentProps<typeof actual.Box> & { component?: 'form' }) => {
      if (props.component === 'form' && mocks.states[7])
        mocks.submit = () => (props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault: vi.fn() });
      return <actual.Box {...props} />;
    },
    TextField: (props: ComponentProps<typeof actual.TextField>) => {
      if (props.name)
        mocks.fields.set(props.name, {
          disabled: props.disabled,
          onChange: props.onChange as (event: { target: { value: string } }) => void,
        });
      return <actual.TextField {...props} />;
    },
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (typeof props.children === 'string')
        mocks.buttons.set(props.children, { disabled: props.disabled, onClick: props.onClick as () => void });
      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ hasPermission: (name: string) => !mocks.denied.has(name) }),
}));
vi.mock('@/services/roles/rolesService', () => ({
  rolesService: {
    listPage: mocks.listPage,
    create: mocks.create,
    update: mocks.update,
    deactivate: mocks.deactivate,
    reactivate: mocks.reactivate,
  },
}));
vi.mock('@/components/pagination/ListPagination', async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof ListPagination }>();
  return {
    default: (props: ComponentProps<typeof ListPagination>) => {
      mocks.pagination = props;
      return <actual.default {...props} />;
    },
  };
});

const base: AdministrativeRole = {
  idRole: 1,
  name: 'SUPERADMIN',
  description: 'Administración',
  isActive: true,
  isSystem: true,
  permissionCount: 27,
};
const custom: AdministrativeRole = { ...base, idRole: 5, name: 'RECEPTION', isSystem: false, permissionCount: 0 };
const makePage = (roles: AdministrativeRole[], page = 1, limit = 10): RolesPage => ({
  status: true,
  statusCode: 200,
  data: roles,
  meta: { page, limit, total: roles.length, totalPages: roles.length ? 1 : 0 },
});
function render() {
  mocks.index = 0;
  mocks.effect = null;
  mocks.submit = null;
  return renderToStaticMarkup(<RolesAdministration />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  const query: RolesQuery = { page: 1, limit: 10, status: 'all', search: '' };
  mocks.states[0] = query;
  mocks.states[2] = makePage([base]);
  mocks.states[3] = { query, refresh: 0 };
  mocks.fields.clear();
  mocks.buttons.clear();
  mocks.denied.clear();
  mocks.pagination = null;
  mocks.create.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue(undefined);
  mocks.deactivate.mockResolvedValue(undefined);
  mocks.reactivate.mockResolvedValue(undefined);
});

describe('Administrative role interactions', () => {
  it('shows the Spanish label alongside the intact code, state and permission count', () => {
    const html = render();
    for (const text of ['ADMINISTRADOR', 'SUPERADMIN', 'Administración', 'Rol base', 'Activo', '27', 'Código interno'])
      expect(html).toContain(text);
  });

  it('creates a custom role without translating its code or sending permission data', async () => {
    render();
    mocks.buttons.get('Crear rol')?.onClick?.();
    render();
    mocks.fields.get('name')?.onChange?.({ target: { value: 'RECEPTION' } });
    mocks.fields.get('description')?.onChange?.({ target: { value: 'Recepción' } });
    render();
    await mocks.submit?.();
    expect(mocks.create).toHaveBeenCalledWith({ name: 'RECEPTION', description: 'Recepción' });
    expect(mocks.states[7]).toBeNull();
    expect(mocks.states[6]).toBe('Rol guardado correctamente.');
  });

  it('edits a base description while its code stays fixed and permissions are untouched', async () => {
    render();
    mocks.buttons.get('Editar')?.onClick?.();
    render();
    expect(mocks.fields.get('name')?.disabled).toBe(true);
    mocks.fields.get('description')?.onChange?.({ target: { value: 'Nueva descripción' } });
    render();
    await mocks.submit?.();
    expect(mocks.update).toHaveBeenCalledWith(1, { description: 'Nueva descripción' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('retains the editor and displays API errors on duplicate creation', async () => {
    mocks.states[7] = 'create';
    mocks.states[8] = { name: 'RECEPTION', description: '' };
    mocks.create.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Role already exists' } } });
    render();
    await mocks.submit?.();
    expect(mocks.states[7]).toBe('create');
    expect(render()).toContain('Role already exists');
  });

  it('rejects forced base deactivation but allows custom deactivation and reactivation', async () => {
    mocks.states[9] = base;
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await Promise.resolve();
    expect(mocks.deactivate).not.toHaveBeenCalled();
    mocks.states[9] = custom;
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await vi.waitFor(() => expect(mocks.states[9]).toBeNull());
    expect(mocks.deactivate).toHaveBeenCalledWith(5);
    mocks.states[9] = { ...custom, isActive: false };
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await vi.waitFor(() => expect(mocks.states[9]).toBeNull());
    expect(mocks.reactivate).toHaveBeenCalledWith(5);
  });

  it('requests changed pagination, preserves filters and shows loading and empty results', async () => {
    const query: RolesQuery = { page: 1, limit: 10, status: 'inactive', search: 'RECEPTION' };
    mocks.states[0] = query;
    mocks.states[3] = { query, refresh: 0 };
    render();
    mocks.pagination?.onChange({ page: 1, limit: 25 });
    expect(render()).toContain('Cargando roles');
    mocks.listPage.mockResolvedValueOnce(makePage([], 1, 25));
    mocks.effect?.();
    await vi.waitFor(() => expect(mocks.states[3]).toEqual({ query: mocks.states[0], refresh: 0 }));
    expect(mocks.listPage).toHaveBeenCalledWith({ page: 1, limit: 25, status: 'inactive', search: 'RECEPTION' });
    expect(render()).toContain('No se encontraron roles.');
    expect(render()).toContain('0–0 de 0');
  });

  it('does not request the list or save after permissions are revoked', async () => {
    mocks.denied.add('role.get-all');
    expect(render()).toContain('No tienes permiso');
    mocks.effect?.();
    expect(mocks.listPage).not.toHaveBeenCalled();
    mocks.denied.delete('role.get-all');
    mocks.denied.add('role.update');
    mocks.states[7] = base;
    mocks.states[8] = { name: base.name, description: 'Nueva' };
    render();
    await mocks.submit?.();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
