import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersAdministration from './UsersAdministration';
import type ListPagination from '@/components/pagination/ListPagination';

import type { AdministrativeUser, CreateUser, UserFields, UsersPage, UsersQuery } from '@/types/users';

const mocks = vi.hoisted(() => ({
  stateIndex: 0,
  query: null as UsersQuery | null,
  search: '',
  searchSubmit: null as (() => void) | null,
  searchChange: null as ((event: { target: { value: string } }) => void) | null,
  clearSearch: null as (() => void) | null,
  effects: [] as (() => unknown)[],
  runEffects: false,
  paginationTest: false,
  pagination: null as ComponentProps<typeof ListPagination> | null,
  pageResult: null as UsersPage | null,
  completed: null as { query: UsersQuery; refresh: number } | null,
  list: vi.fn().mockResolvedValue({ data: [], meta: { totalPages: 1 } }),
  target: null as AdministrativeUser | null,
  editor: null as { id?: number; roleNames?: string[] } | null,
  form: { username: 'ana', email: 'ana@example.com', name: 'Ana', lastname: 'Pérez', ci: '123' } as
    (UserFields & { roleNames?: string[] }) | CreateUser,
  detail: null as AdministrativeUser | null,
  setForm: vi.fn(),
  setDialogError: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
  replaceRoles: vi.fn().mockResolvedValue(undefined),
  deniedPermissions: new Set<string>(),
  roleInput: null as {
    value?: readonly string[];
    disabled?: boolean;
    onChange?: (event: unknown, value: string[]) => void;
  } | null,
  roleField: null as { error?: boolean; helperText?: unknown } | null,
  create: vi.fn().mockResolvedValue(undefined),
  submit: null as (() => Promise<void>) | null,
  setStatus: vi.fn(),
  deactivate: vi.fn().mockResolvedValue(undefined),
  reactivate: vi.fn().mockResolvedValue(undefined),
  buttons: new Map<string, { disabled?: boolean; onClick?: () => void | Promise<void> }>(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();

  return {
    ...actual,
    useEffect: (effect: () => unknown) => {
      if (mocks.runEffects) mocks.effects.push(effect);
    },
    useState: (initial: unknown) => {
      const index = mocks.stateIndex++;

      if (index === 0) {
        mocks.query ??= initial as UsersQuery;
        return [
          mocks.query,
          (update: (current: UsersQuery) => UsersQuery) => {
            mocks.query = update(mocks.query!);
          },
        ];
      }
      if (index === 1)
        return [
          mocks.search,
          (value: string) => {
            mocks.search = value;
          },
        ];
      if (index === 2)
        if (mocks.paginationTest)
          return [
            mocks.pageResult,
            (value: UsersPage | null) => {
              mocks.pageResult = value;
            },
          ];
      if (index === 2)
        return [
          {
            data: [
              {
                idUser: 1,
                isActive: true,
                roles: ['SUPERADMIN', 'STAFF', 'DOCTOR', 'PATIENT'].map((name) => ({ name, isActive: true })),
              },
            ],
            meta: { total: 1 },
          },
          vi.fn(),
        ];
      if (index === 3) {
        if (mocks.paginationTest)
          return [
            mocks.completed,
            (value: typeof mocks.completed) => {
              mocks.completed = value;
            },
          ];
        return [{ query: mocks.query, refresh: 0 }, vi.fn()];
      }
      if (index === 7) return [mocks.editor, vi.fn()];
      if (index === 8) return [mocks.form, mocks.setForm];
      if (index === 10) return [mocks.detail, vi.fn()];
      if (index === 11) return [mocks.target, mocks.setStatus];
      if (index === 13) return [null, mocks.setDialogError];

      return [initial, vi.fn()];
    },
  };
});
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof MuiModule>();

  return {
    ...actual,
    Dialog: ({ open, children }: ComponentProps<typeof actual.Dialog>) => (open ? <>{children}</> : null),
    Autocomplete: (props: ComponentProps<typeof actual.Autocomplete>) => {
      mocks.roleInput = props as unknown as typeof mocks.roleInput;
      return <actual.Autocomplete {...props} />;
    },
    IconButton: (props: ComponentProps<typeof actual.IconButton>) => {
      if (props['aria-label'] === 'Limpiar búsqueda') mocks.clearSearch = props.onClick as () => void;
      return <actual.IconButton {...props} />;
    },
    TextField: (props: ComponentProps<typeof actual.TextField>) => {
      if (props.label === 'Buscar usuarios') mocks.searchChange = props.onChange as typeof mocks.searchChange;
      if (props.label === 'Roles (obligatorio)') mocks.roleField = props;
      return <actual.TextField {...props} />;
    },
    Box: (props: ComponentProps<typeof actual.Box> & { component?: 'form' }) => {
      if (props.component === 'form' && props.children && mocks.editor) {
        mocks.submit = () => (props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault: vi.fn() });
      }
      if (props.component === 'form') {
        mocks.searchSubmit ??= () => (props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
      }

      return <actual.Box {...props} />;
    },
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (typeof props.children === 'string') {
        mocks.buttons.set(props.children, {
          disabled: props.disabled,
          onClick: props.onClick as (() => void) | undefined,
        });
      }

      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({
    user: { idUser: 1 },
    hasPermission: (permission: string) => !mocks.deniedPermissions.has(permission),
  }),
}));
vi.mock('@/services/users/usersService', () => ({
  usersService: {
    deactivate: mocks.deactivate,
    reactivate: mocks.reactivate,
    update: mocks.update,
    replaceRoles: mocks.replaceRoles,
    create: mocks.create,
    list: mocks.list,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stateIndex = 0;
  mocks.query = null;
  mocks.search = '';
  mocks.searchSubmit = null;
  mocks.searchChange = null;
  mocks.clearSearch = null;
  mocks.effects = [];
  mocks.runEffects = false;
  mocks.paginationTest = false;
  mocks.pagination = null;
  mocks.pageResult = null;
  mocks.completed = null;
  mocks.target = null;
  mocks.editor = null;
  mocks.deniedPermissions.clear();
  mocks.roleInput = null;
  mocks.roleField = null;
  mocks.detail = null;
  mocks.submit = null;
  mocks.form = { username: 'ana', email: 'ana@example.com', name: 'Ana', lastname: 'Pérez', ci: '123' };
  mocks.buttons.clear();
});

describe('User list with shared pagination', () => {
  it('loads changed pages and page sizes, preserves filters and renders loading and empty results', async () => {
    mocks.paginationTest = true;
    mocks.query = { page: 1, limit: 10, status: 'inactive', search: 'Ana' };
    const makePage = (page: number, limit: number, idUser?: number): UsersPage => ({
      status: true,
      statusCode: 200,
      data:
        idUser === undefined
          ? []
          : [
              {
                idUser,
                username: `usuario-${idUser}`,
                name: 'Ana',
                lastname: 'Pérez',
                email: 'ana@example.com',
                ci: '123',
                isActive: false,
                roles: [],
              },
            ],
      meta: {
        page,
        limit,
        total: idUser === undefined ? 0 : 57,
        totalPages: idUser === undefined ? 0 : Math.ceil(57 / limit),
      },
    });
    mocks.pageResult = makePage(1, 10, 1);
    mocks.completed = { query: mocks.query, refresh: 0 };
    const render = () => {
      mocks.stateIndex = 0;
      mocks.effects = [];
      return renderToStaticMarkup(<UsersAdministration />);
    };
    expect(render()).toContain('usuario-1');
    mocks.pagination?.onChange({ page: 2, limit: 10 });
    expect(render()).toContain('Cargando usuarios');
    expect(render()).not.toContain('usuario-1');
    mocks.list.mockResolvedValueOnce(makePage(2, 10, 11));
    mocks.runEffects = true;
    render();
    mocks.effects[0]();
    await vi.waitFor(() => expect(mocks.completed?.query).toBe(mocks.query));
    expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, limit: 10, status: 'inactive', search: 'Ana' });
    expect(render()).toContain('usuario-11');
    expect(render()).toContain('11–20 de 57');
    mocks.pagination?.onChange({ page: 1, limit: 25 });
    expect(render()).toContain('Cargando usuarios');
    mocks.list.mockResolvedValueOnce(makePage(1, 25));
    render();
    mocks.effects[0]();
    await vi.waitFor(() => expect(mocks.completed?.query).toBe(mocks.query));
    expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, limit: 25, status: 'inactive', search: 'Ana' });
    expect(render()).toContain('No se encontraron usuarios.');
    expect(render()).toContain('0–0 de 0');
  });
});

describe('Role labels and user search', () => {
  it('uses Spanish labels in the table, details and selected roles while preserving request values', async () => {
    const roleNames = ['SUPERADMIN', 'STAFF', 'DOCTOR', 'PATIENT'];
    mocks.editor = {};
    mocks.form = { ...mocks.form, password: 'initial-secret', roleNames };
    mocks.detail = {
      ...mocks.form,
      idUser: 2,
      isActive: true,
      roles: roleNames.map((name, idRole) => ({ name, idRole, isActive: true })),
    };
    const html = renderToStaticMarkup(<UsersAdministration />);
    for (const label of ['ADMINISTRADOR', 'PERSONAL', 'DOCTOR', 'PACIENTE']) expect(html).toContain(label);
    expect(html).not.toContain('SUPERADMIN');
    expect(html).not.toContain('STAFF');
    expect(html).not.toContain('PATIENT');
    await mocks.submit?.();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ roleNames }));
  });

  it('applies trimmed search on submit and clears it immediately without changing the page size or status', () => {
    mocks.query = { page: 3, limit: 25, status: 'active', search: 'previous' };
    renderToStaticMarkup(<UsersAdministration />);
    mocks.searchChange?.({ target: { value: ' Ana ' } });
    expect(mocks.query.search).toBe('previous');
    mocks.stateIndex = 0;
    mocks.searchSubmit = null;
    renderToStaticMarkup(<UsersAdministration />);
    (mocks.searchSubmit as (() => void) | null)?.();
    expect(mocks.query).toEqual({ page: 1, limit: 25, status: 'active', search: 'Ana' });
    expect(mocks.clearSearch).not.toBeNull();
    mocks.clearSearch?.();
    expect(mocks.search).toBe('');
    expect(mocks.query).toEqual({ page: 1, limit: 25, status: 'active', search: undefined });
    mocks.stateIndex = 0;
    expect(renderToStaticMarkup(<UsersAdministration />)).not.toContain('Limpiar búsqueda');
    mocks.runEffects = true;
    mocks.stateIndex = 0;
    renderToStaticMarkup(<UsersAdministration />);
    mocks.effects[0]();
    expect(mocks.list).toHaveBeenCalledWith({ page: 1, limit: 25, status: 'active', search: undefined });
  });

  it.each(['', '   '])('removes the applied search when input becomes %j and avoids redundant updates', (value) => {
    mocks.query = { page: 4, limit: 50, status: 'all', search: 'Ana' };
    renderToStaticMarkup(<UsersAdministration />);
    mocks.searchChange?.({ target: { value } });
    expect(mocks.query).toEqual({ page: 1, limit: 50, status: 'all', search: undefined });
    const cleared = mocks.query;
    mocks.searchChange?.({ target: { value } });
    expect(mocks.query).toBe(cleared);
  });
});

describe('Required user roles', () => {
  it.each([{ editor: {}, password: 'initial-secret' }, { editor: { id: 2, roleNames: ['DOCTOR'] } }])(
    'prevents saving empty roles in $editor',
    async ({ editor, password }) => {
      mocks.editor = editor;
      mocks.form = { ...mocks.form, ...(password ? { password } : {}), roleNames: [] };
      const html = renderToStaticMarkup(<UsersAdministration />);
      expect(html).toContain('Roles (obligatorio)');
      expect(html).toContain('Selecciona al menos un rol para este usuario.');
      expect(mocks.roleField?.error).toBe(true);
      expect(mocks.buttons.get('Guardar')?.disabled).toBe(true);
      await mocks.submit?.();
      expect(mocks.setDialogError).toHaveBeenLastCalledWith('El usuario debe tener al menos un rol');
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.replaceRoles).not.toHaveBeenCalled();
    },
  );

  it.each([{ roleNames: ['STAFF'] }, { roleNames: ['DOCTOR', 'STAFF'] }])(
    'allows creation with $roleNames explicitly selected',
    async ({ roleNames }) => {
      mocks.editor = {};
      mocks.form = { ...mocks.form, password: 'secret', roleNames };
      renderToStaticMarkup(<UsersAdministration />);
      expect(mocks.roleField?.error).toBe(false);
      expect(mocks.buttons.get('Guardar')?.disabled).toBe(false);
      await mocks.submit?.();
      expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ roleNames }));
    },
  );

  it('blocks removing the last role, then allows explicitly changing DOCTOR to STAFF', async () => {
    mocks.editor = { id: 2, roleNames: ['DOCTOR'] };
    mocks.form = { ...mocks.form, roleNames: ['DOCTOR'] };
    renderToStaticMarkup(<UsersAdministration />);
    expect(mocks.roleInput?.value).toEqual(['DOCTOR']);
    const select = (roles: string[]) => {
      mocks.roleInput?.onChange?.(null, roles);
      const update = mocks.setForm.mock.calls.at(-1)?.[0] as (current: typeof mocks.form) => typeof mocks.form;
      mocks.form = update(mocks.form);
      mocks.stateIndex = 0;
      renderToStaticMarkup(<UsersAdministration />);
    };
    select([]);
    await mocks.submit?.();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.roleField?.error).toBe(true);
    select(['STAFF']);
    await mocks.submit?.();
    expect(mocks.roleField?.error).toBe(false);
    expect(mocks.replaceRoles).toHaveBeenCalledWith(2, ['STAFF']);
  });

  it('repairs legacy roleless users only after explicit selection and saves roles before data', async () => {
    mocks.editor = { id: 2, roleNames: [] };
    mocks.form = { ...mocks.form, roleNames: [] };
    renderToStaticMarkup(<UsersAdministration />);
    await mocks.submit?.();
    expect(mocks.replaceRoles).not.toHaveBeenCalled();
    mocks.roleInput?.onChange?.(null, ['STAFF']);
    const update = mocks.setForm.mock.calls.at(-1)?.[0] as (current: typeof mocks.form) => typeof mocks.form;
    mocks.form = update(mocks.form);
    mocks.stateIndex = 0;
    renderToStaticMarkup(<UsersAdministration />);
    await mocks.submit?.();
    expect(mocks.replaceRoles).toHaveBeenCalledWith(2, ['STAFF']);
    expect(mocks.replaceRoles.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
  });

  it('explains partial saves when legacy role repair succeeds but the data update fails', async () => {
    mocks.editor = { id: 2, roleNames: [] };
    mocks.form = { ...mocks.form, roleNames: ['STAFF'] };
    mocks.update.mockRejectedValueOnce(new Error('failed'));
    renderToStaticMarkup(<UsersAdministration />);
    await mocks.submit?.();
    expect(mocks.replaceRoles).toHaveBeenCalledWith(2, ['STAFF']);
    expect(mocks.setDialogError).toHaveBeenLastCalledWith(
      expect.stringContaining('Los roles del usuario se guardaron, pero los datos no'),
    );
    expect(mocks.setForm).not.toHaveBeenCalled();
  });
});

describe('Editing role assignments', () => {
  it('keeps the editor open and explains partial saves if role replacement fails', async () => {
    mocks.editor = { id: 2, roleNames: ['STAFF'] };
    mocks.form = { ...mocks.form, roleNames: ['DOCTOR'] };
    mocks.replaceRoles.mockRejectedValueOnce(new Error('failed'));
    renderToStaticMarkup(<UsersAdministration />);
    await mocks.submit?.();
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.setDialogError).toHaveBeenLastCalledWith(
      expect.stringContaining('Los datos del usuario se guardaron, pero los roles no'),
    );
    expect(mocks.setForm).not.toHaveBeenCalled();
  });
  it.each([{ selection: ['DOCTOR'] }, { selection: ['STAFF', 'DOCTOR'] }])(
    'saves the selected roles $selection separately from administrative fields',
    async ({ selection }) => {
      mocks.editor = { id: 2, roleNames: ['STAFF'] };
      mocks.form = { ...mocks.form, roleNames: ['STAFF'] };
      renderToStaticMarkup(<UsersAdministration />);
      expect(mocks.roleInput?.value).toEqual(['STAFF']);
      expect(mocks.roleInput?.disabled).toBe(false);
      mocks.roleInput?.onChange?.(null, selection);
      const update = mocks.setForm.mock.calls.at(-1)?.[0] as (current: typeof mocks.form) => typeof mocks.form;
      mocks.form = update(mocks.form);
      mocks.stateIndex = 0;
      renderToStaticMarkup(<UsersAdministration />);
      await mocks.submit?.();
      expect(mocks.replaceRoles).toHaveBeenCalledWith(2, selection);
      expect(mocks.update).toHaveBeenCalledWith(2, expect.not.objectContaining({ roleNames: expect.anything() }));
    },
  );

  it('does not call role replacement for unchanged selection or without the assignment permission', async () => {
    mocks.editor = { id: 2, roleNames: ['STAFF'] };
    mocks.form = { ...mocks.form, roleNames: ['STAFF'] };
    renderToStaticMarkup(<UsersAdministration />);
    await mocks.submit?.();
    expect(mocks.replaceRoles).not.toHaveBeenCalled();
    mocks.deniedPermissions.add('user.assign-roles');
    mocks.form = { ...mocks.form, roleNames: ['DOCTOR'] };
    mocks.stateIndex = 0;
    renderToStaticMarkup(<UsersAdministration />);
    expect(mocks.roleInput?.disabled).toBe(true);
    await mocks.submit?.();
    expect(mocks.replaceRoles).not.toHaveBeenCalled();
  });
});

describe('Administrative credentials', () => {
  it('renders edit without credentials and sends only administrative fields', async () => {
    mocks.editor = { id: 2 };
    // Even stale creation state must not be included in an edit request.
    mocks.form = { ...mocks.form, password: 'creation-secret', roleNames: ['STAFF'] };
    const html = renderToStaticMarkup(<UsersAdministration />);
    expect(html).toContain('Editar usuario');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain('creation-secret');
    expect(mocks.submit).not.toBeNull();
    await mocks.submit?.();
    expect(mocks.update).toHaveBeenCalledWith(2, {
      username: 'ana',
      email: 'ana@example.com',
      name: 'Ana',
      lastname: 'Pérez',
      ci: '123',
    });
    expect(mocks.setForm).toHaveBeenCalledWith(expect.not.objectContaining({ password: expect.anything() }));
  });

  it('keeps the initial password required in creation and clears credentials when opening edit', async () => {
    mocks.editor = {};
    mocks.form = { ...mocks.form, password: 'initial-secret', roleNames: ['STAFF'] };
    const html = renderToStaticMarkup(<UsersAdministration />);
    expect(html).toContain('name="password"');
    expect(html).toMatch(/<input[^>]*required[^>]*type="password"/);
    await mocks.submit?.();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ password: 'initial-secret' }));
    mocks.buttons.get('Editar')?.onClick?.();
    const lastForm = mocks.setForm.mock.calls.at(-1)?.[0] as object;
    expect(lastForm).not.toHaveProperty('password');
    expect(lastForm).toHaveProperty('roleNames', ['SUPERADMIN', 'STAFF', 'DOCTOR', 'PATIENT']);
  });

  it('does not render secrets in user details', () => {
    mocks.detail = {
      ...mocks.form,
      idUser: 2,
      isActive: true,
      roles: [],
      password: 'hidden-hash',
      refreshToken: 'hidden-refresh',
      resetToken: 'hidden-reset',
    } as unknown as AdministrativeUser;
    const html = renderToStaticMarkup(<UsersAdministration />);
    expect(html).toContain('Información del usuario');
    expect(html).not.toMatch(/hidden-hash|hidden-refresh|hidden-reset/);
  });
});

describe('User status interaction guards', () => {
  it('does not open confirmation or call HTTP when invoking the self-deactivation action', () => {
    renderToStaticMarkup(<UsersAdministration />);
    expect(mocks.buttons.get('Desactivar')?.disabled).toBe(true);
    mocks.buttons.get('Desactivar')?.onClick?.();
    expect(mocks.setStatus).not.toHaveBeenCalled();
    expect(mocks.deactivate).not.toHaveBeenCalled();
  });

  it('blocks self-deactivation even if confirmation is already open', async () => {
    mocks.target = { idUser: 1, isActive: true } as AdministrativeUser;
    renderToStaticMarkup(<UsersAdministration />);
    expect(mocks.buttons.has('Confirmar')).toBe(true);
    mocks.buttons.get('Confirmar')?.onClick?.();
    await Promise.resolve();
    expect(mocks.deactivate).not.toHaveBeenCalled();
  });

  it('continues to deactivate another user and allows restoring the same ID', async () => {
    mocks.target = { idUser: 2, isActive: true } as AdministrativeUser;
    renderToStaticMarkup(<UsersAdministration />);
    expect(mocks.buttons.has('Confirmar')).toBe(true);
    mocks.buttons.get('Confirmar')?.onClick?.();
    await Promise.resolve();
    expect(mocks.deactivate).toHaveBeenCalledWith(2);
    mocks.stateIndex = 0;
    mocks.target = { idUser: 1, isActive: false } as AdministrativeUser;
    renderToStaticMarkup(<UsersAdministration />);
    mocks.buttons.get('Confirmar')?.onClick?.();
    await Promise.resolve();
    expect(mocks.reactivate).toHaveBeenCalledWith(1);
  });
});
