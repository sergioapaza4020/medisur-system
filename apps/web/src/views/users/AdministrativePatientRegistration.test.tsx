import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdministrativePatientRegistration from './AdministrativePatientRegistration';
import type ListPagination from '@/components/pagination/ListPagination';

import type { PatientRegistration } from '@/types/auth';
import type { UsersQuery } from '@/types/users';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effect: null as (() => void | (() => void)) | null,
  forms: [] as (() => Promise<void> | void)[],
  authorized: true,
  fields: new Map<string, { disabled?: boolean; onChange?: (event: { target: { value: string } }) => void }>(),
  search: vi.fn(),
  create: vi.fn(),
  pagination: null as ComponentProps<typeof ListPagination> | null,
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
      mocks.effect ??= effect;
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
        mocks.fields.set(props.name, {
          disabled: props.disabled,
          onChange: props.onChange as (event: { target: { value: string } }) => void,
        });
      return <actual.TextField {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ hasPermission: (name: string) => name === 'user.create-patient' && mocks.authorized }),
}));
vi.mock('@/services/users/usersService', () => ({
  usersService: { searchForPatientRegistration: mocks.search, createPatient: mocks.create },
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

const valid: PatientRegistration = {
  name: ' Ana ',
  lastname: ' Pérez ',
  email: ' ANA@EXAMPLE.COM ',
  ci: ' 123456 ',
  password: 'Segura123',
};
const query: UsersQuery = { page: 1, limit: 10, status: 'all', search: '123' };
const result = {
  data: [
    {
      idUser: 1,
      name: 'Ana',
      lastname: 'Pérez',
      email: 'ana@example.com',
      ci: '123456',
      isActive: false,
      isPatient: true,
    },
  ],
  meta: { ...query, total: 12, totalPages: 2 },
};
function render() {
  mocks.index = 0;
  mocks.effect = null;
  mocks.forms = [];
  mocks.fields.clear();
  return renderToStaticMarkup(<AdministrativePatientRegistration />);
}
async function flush() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized = true;
  mocks.pagination = null;
  mocks.states = ['123', query, result, { query, refresh: 0 }, 0, { ...valid }, {}, null, null, false, false];
  mocks.search.mockResolvedValue(result);
  mocks.create.mockResolvedValue({ idUser: 2, email: 'ana@example.com' });
});

describe('Administrative patient registration', () => {
  it('denies unauthorized access and needs only its specific permission', () => {
    mocks.authorized = false;
    expect(render()).toContain('No tienes permiso para registrar pacientes');
    mocks.effect?.();
    expect(mocks.search).not.toHaveBeenCalled();
    mocks.authorized = true;
    const html = render();
    expect(html).toContain('Registrar paciente');
    expect(html).toContain('Inactivo');
    expect([...mocks.fields.keys()]).toEqual(['search', 'name', 'lastname', 'email', 'ci', 'password']);
    expect(html).not.toContain('Asignar roles');
  });
  it('searches prior accounts and preserves search and inactive status across shared pagination', async () => {
    render();
    mocks.fields.get('search')?.onChange?.({ target: { value: ' ana@example.com ' } });
    render();
    await mocks.forms[0]();
    expect(mocks.states[1]).toEqual({ ...query, search: 'ana@example.com' });
    expect(render()).toContain('Buscando cuentas existentes');
    mocks.effect?.();
    await flush();
    expect(mocks.search).toHaveBeenCalledWith({ ...query, search: 'ana@example.com' });
    render();
    mocks.pagination?.onChange({ page: 2, limit: 25 });
    expect(mocks.states[1]).toEqual({ page: 2, limit: 25, status: 'all', search: 'ana@example.com' });
    expect(render()).toContain('Buscando cuentas existentes');
    mocks.effect?.();
    await flush();
    expect(mocks.search).toHaveBeenLastCalledWith({ page: 2, limit: 25, status: 'all', search: 'ana@example.com' });
  });
  it('handles empty results and lookup errors without loading a catalog before a search', async () => {
    mocks.states[1] = null;
    render();
    mocks.effect?.();
    expect(mocks.search).not.toHaveBeenCalled();
    mocks.states[1] = query;
    mocks.search.mockResolvedValueOnce({ data: [], meta: { ...query, total: 0, totalPages: 0 } });
    render();
    mocks.effect?.();
    await flush();
    expect(render()).toContain('No se encontraron cuentas coincidentes');
    mocks.search.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Consulta rechazada' } } });
    mocks.effect?.();
    await flush();
    expect(render()).toContain('Consulta rechazada');
  });
  it('reuses patient validation and saves the normalized account without roles or author fields', async () => {
    mocks.states[5] = { ...valid, password: 'weak' };
    render();
    await mocks.forms[1]();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(render()).toContain('una mayúscula');
    mocks.fields.get('password')?.onChange?.({ target: { value: 'Segura123' } });
    render();
    await mocks.forms[1]();
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
      name: 'Ana',
      lastname: 'Pérez',
      email: 'ana@example.com',
      ci: '123456',
      password: 'Segura123',
    });
    expect(render()).toContain('Paciente registrado correctamente: ana@example.com');
    expect((mocks.states[5] as PatientRegistration).password).toBe('');
    expect(mocks.states[4]).toBe(1);
  });
  it('prevents double submission before rerender and disables form fields during creation', async () => {
    let resolve!: (value: { idUser: number; email: string }) => void;
    mocks.create.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render();
    const submit = mocks.forms[1];
    const pending = submit();
    await submit();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(render()).toContain('Registrando');
    expect([...mocks.fields.values()].every((field) => field.disabled)).toBe(true);
    resolve({ idUser: 2, email: 'ana@example.com' });
    await pending;
  });
  it('preserves identity data, clears the password and shows API duplicate feedback after failure', async () => {
    mocks.create.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Ya existe una cuenta con ese correo electrónico o documento' } },
    });
    render();
    await mocks.forms[1]();
    expect(render()).toContain('Ya existe una cuenta');
    expect(mocks.states[5]).toEqual({ ...valid, password: '' });
    expect(mocks.states[9]).toBe(false);
    mocks.fields.get('password')?.onChange?.({ target: { value: 'Segura123' } });
    render();
    await mocks.forms[1]();
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
});
