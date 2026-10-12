import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorRegistration from './DoctorRegistration';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  forms: [] as (() => Promise<void> | void)[],
  buttons: new Map<string, { disabled?: boolean; onClick?: () => void }>(),
  fields: new Map<string, { onChange?: (event: { target: { value: string } }) => void }>(),
  pagination: [] as ComponentProps<typeof ListPagination>[],
  denied: new Set<string>(),
  searchUsers: vi.fn(),
  create: vi.fn(),
  listSpecialties: vi.fn(),
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 15) return [initial, vi.fn()];
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
      mocks.effects.push(effect);
    },
  };
});
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof MuiModule>();
  return {
    ...actual,
    Box: (props: ComponentProps<typeof actual.Box> & { component?: 'form' }) => {
      if (props.component === 'form')
        mocks.forms.push(() => (props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault: vi.fn() }));
      return <actual.Box {...props} />;
    },
    TextField: (props: ComponentProps<typeof actual.TextField>) => {
      if (props.name)
        mocks.fields.set(props.name, { onChange: props.onChange as (event: { target: { value: string } }) => void });
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
vi.mock('@/services/doctors/doctorsService', () => ({
  doctorsService: { searchUsers: mocks.searchUsers, create: mocks.create },
}));
vi.mock('@/services/specialties/specialtiesService', () => ({
  specialtiesService: { listPage: mocks.listSpecialties },
}));
vi.mock('@/components/pagination/ListPagination', async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof ListPagination }>();
  return {
    default: (props: ComponentProps<typeof ListPagination>) => {
      mocks.pagination.push(props);
      return <actual.default {...props} />;
    },
  };
});

const user = { idUser: 4, name: 'Ana', lastname: 'Pérez', email: 'ana@example.com', ci: '123456', isActive: true };
const query = { page: 1, limit: 10, status: 'all' as const, search: 'ana' };
const specialtyQuery = { page: 1, limit: 10, status: 'active' as const };
const accounts = { data: [user], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };
const specialties = {
  data: [
    { idSpecialty: 1, name: 'Cardiología', isActive: true },
    { idSpecialty: 2, name: 'Medicina interna', isActive: true },
  ],
  meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
};
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.forms = [];
  mocks.buttons.clear();
  mocks.fields.clear();
  mocks.pagination = [];
  return renderToStaticMarkup(<DoctorRegistration />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.states = [
    'ana',
    query,
    accounts,
    { query, refresh: 0 },
    0,
    null,
    specialtyQuery,
    specialties,
    { query: specialtyQuery, refresh: 0 },
    [],
    true,
    null,
    null,
    null,
    false,
  ];
  mocks.searchUsers.mockResolvedValue(accounts);
  mocks.listSpecialties.mockResolvedValue(specialties);
  mocks.create.mockResolvedValue({ user });
});

describe('Doctor registration', () => {
  it('denies the route and network requests without its specific permission', () => {
    mocks.denied.add('doctor.create');
    expect(render()).toContain('No tienes permiso para registrar médicos');
    mocks.effects.forEach((effect) => effect());
    expect(mocks.searchUsers).not.toHaveBeenCalled();
    expect(mocks.listSpecialties).not.toHaveBeenCalled();
  });

  it('does not require general user or role grants, and hides inaccessible account creation/specialties', () => {
    ['user.create', 'user.assign-roles', 'user.get-all', 'specialty.get-all'].forEach((name) => mocks.denied.add(name));
    const html = render();
    expect(html).toContain('Registrar médico');
    expect(html).not.toContain('Crear cuenta desde Usuarios');
    expect(html).toContain('No tienes permiso para consultar especialidades');
    mocks.effects[1]();
    expect(mocks.listSpecialties).not.toHaveBeenCalled();
  });

  it('selects an active user, creates an inactive profile with multiple specialties and prevents duplicate submissions', async () => {
    render();
    mocks.buttons.get('Seleccionar')?.onClick?.();
    expect(mocks.states[5]).toEqual(user);
    mocks.states[9] = specialties.data;
    mocks.states[10] = false;
    render();
    const submit = mocks.forms[1];
    await Promise.all([submit(), submit()]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({ idUser: 4, isActive: false, specialtyIds: [1, 2] });
    expect(mocks.states[5]).toBeNull();
    expect(mocks.states[9]).toEqual([]);
    expect(render()).toContain('Médico registrado correctamente: Ana Pérez');
  });

  it('rejects missing/inactive selections and disables inactive user selection', async () => {
    render();
    expect(mocks.buttons.get('Registrar médico')?.disabled).toBe(true);
    await mocks.forms[1]();
    expect(render()).toContain('Selecciona una cuenta activa existente.');
    mocks.states[2] = { ...accounts, data: [{ ...user, isActive: false }] };
    render();
    expect(mocks.buttons.get('Seleccionar')?.disabled).toBe(true);
    mocks.buttons.get('Seleccionar')?.onClick?.();
    expect(mocks.states[5]).toBeNull();
    mocks.states[5] = { ...user, isActive: false };
    render();
    await mocks.forms[1]();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('retains the selection and reports duplicate API errors without partial UI success', async () => {
    mocks.states[5] = user;
    mocks.create.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Este usuario ya tiene un perfil médico' } },
    });
    render();
    await mocks.forms[1]();
    expect(mocks.states[5]).toEqual(user);
    expect(mocks.states[13]).toBeNull();
    expect(render()).toContain('ya tiene un perfil médico');
  });

  it('reuses pagination for both account search and active specialty selection', async () => {
    render();
    mocks.fields.get('search')?.onChange?.({ target: { value: ' ana@example.com ' } });
    render();
    await mocks.forms[0]();
    expect(mocks.states[1]).toEqual({ ...query, search: 'ana@example.com' });
    render();
    mocks.effects[0]();
    await flush();
    render();
    mocks.pagination[0].onChange({ page: 2, limit: 5 });
    mocks.pagination[1].onChange({ page: 2, limit: 5 });
    expect(render()).toContain('Buscando cuentas');
    mocks.searchUsers.mockResolvedValueOnce({ data: [], meta: { page: 2, limit: 5, total: 6, totalPages: 2 } });
    mocks.listSpecialties.mockResolvedValueOnce({ data: [], meta: { page: 2, limit: 5, total: 6, totalPages: 2 } });
    mocks.effects.forEach((effect) => effect());
    await flush();
    expect(mocks.searchUsers).toHaveBeenCalledWith({ ...query, page: 2, limit: 5, search: 'ana@example.com' });
    expect(mocks.listSpecialties).toHaveBeenCalledWith({ page: 2, limit: 5, status: 'active' });
    const html = render();
    expect(html).toContain('No se encontraron cuentas');
    expect(html).toContain('No hay especialidades activas');
  });

  it('handles loading failures with retry and ignores responses after unmount', async () => {
    mocks.searchUsers.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    mocks.listSpecialties.mockRejectedValueOnce(new Error('Unavailable'));
    render();
    mocks.effects.forEach((effect) => effect());
    await flush();
    expect(render()).toContain('Reintentar búsqueda');
    expect(mocks.states[12]).not.toBeNull();
    mocks.buttons.get('Reintentar búsqueda')?.onClick?.();
    expect(mocks.states[4]).toBe(1);
    render();
    const cleanup = mocks.effects[0]();
    if (typeof cleanup === 'function') cleanup();
    await flush();
    expect(mocks.states[2]).toBeNull();
  });
});
