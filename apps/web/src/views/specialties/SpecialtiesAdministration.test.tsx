import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SpecialtiesAdministration from './SpecialtiesAdministration';
import type ListPagination from '@/components/pagination/ListPagination';

import type { Specialty, SpecialtiesPage, SpecialtiesQuery } from '@/types/specialties';

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
vi.mock('@/services/specialties/specialtiesService', () => ({
  specialtiesService: {
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

const base: Specialty = { idSpecialty: 1, name: 'Cardiología', isActive: true };
const custom: Specialty = { idSpecialty: 5, name: 'Medicina interna', isActive: true };
const makePage = (specialties: Specialty[], page = 1, limit = 10): SpecialtiesPage => ({
  status: true,
  statusCode: 200,
  data: specialties,
  meta: { page, limit, total: specialties.length, totalPages: specialties.length ? 1 : 0 },
});
function render() {
  mocks.index = 0;
  mocks.effect = null;
  mocks.submit = null;
  return renderToStaticMarkup(<SpecialtiesAdministration />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  const query: SpecialtiesQuery = { page: 1, limit: 10, status: 'all', search: '' };
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

describe('Specialty interactions', () => {
  it('hides creation, editing and status actions without their specific permissions', () => {
    mocks.denied.add('specialty.create');
    mocks.denied.add('specialty.update');
    mocks.denied.add('specialty.delete');
    const html = render();
    expect(html).toContain('Cardiología');
    expect(html).not.toContain('Crear especialidad');
    expect(html).not.toContain('Editar');
    expect(html).not.toContain('Desactivar');
    mocks.states[2] = makePage([{ ...base, isActive: false }]);
    mocks.denied.add('specialty.reactivate');
    expect(render()).not.toContain('>Activar<');
  });

  it('edits the name and keeps the dialog open if the API fails', async () => {
    render();
    mocks.buttons.get('Editar')?.onClick?.();
    render();
    expect(mocks.fields.get('name')?.disabled).toBe(false);
    mocks.fields.get('name')?.onChange?.({ target: { value: '  Cardiología pediátrica  ' } });
    mocks.update.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    render();
    await mocks.submit?.();
    expect(mocks.update).toHaveBeenCalledWith(1, { name: 'Cardiología Pediátrica' });
    expect(mocks.states[7]).toEqual(base);
    expect(render()).toContain('No disponible');
    await mocks.submit?.();
    expect(mocks.states[7]).toBeNull();
  });

  it('rejects blank or oversized names before sending and disables blank submission', async () => {
    mocks.states[7] = 'create';
    for (const name of ['   ', 'a'.repeat(101)]) {
      mocks.states[8] = { name };
      render();
      if (!name.trim()) expect(mocks.buttons.get('Guardar')?.disabled).toBe(true);
      await mocks.submit?.();
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('shows list errors with retry and ignores responses after effect cleanup', async () => {
    mocks.listPage.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    render();
    mocks.effect?.();
    await vi.waitFor(() => expect(mocks.states[5]).toBe('No disponible'));
    expect(render()).toContain('Reintentar');
    mocks.buttons.get('Reintentar')?.onClick?.();
    expect(mocks.states[4]).toBe(1);
    mocks.listPage.mockResolvedValueOnce(makePage([]));
    render();
    const cleanup = mocks.effect?.();
    if (typeof cleanup === 'function') cleanup();
    await Promise.resolve();
    expect(mocks.states[2]).toBeNull();
  });

  it('keeps status errors visible and refuses changes after permission revocation', async () => {
    mocks.states[9] = custom;
    mocks.deactivate.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await vi.waitFor(() => expect(mocks.states[11]).toBe('No disponible'));
    expect(mocks.states[9]).toEqual(custom);
    mocks.denied.add('specialty.delete');
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await Promise.resolve();
    expect(mocks.deactivate).toHaveBeenCalledTimes(1);
  });
  it('creates a specialty with its name only', async () => {
    render();
    mocks.buttons.get('Crear especialidad')?.onClick?.();
    render();
    mocks.fields.get('name')?.onChange?.({ target: { value: 'Medicina interna' } });

    render();
    await mocks.submit?.();
    expect(mocks.create).toHaveBeenCalledWith({ name: 'Medicina Interna' });
    expect(mocks.states[7]).toBeNull();
    expect(mocks.states[6]).toBe('Especialidad guardada correctamente.');
  });

  it.each([
    ['  enFERmedad Del corazon', 'Enfermedad Del Corazon'],
    ['  medicina   INTERNA ', 'Medicina Interna'],
    ['enFERmedad del corazón', 'Enfermedad Del Corazón'],
    ['  cirugía   cardiovascular  ', 'Cirugía Cardiovascular'],
  ])('accepts typing unchanged and submits formatted %s', async (input, expected) => {
    mocks.states[7] = 'create';
    mocks.states[8] = { name: '' };
    render();
    mocks.fields.get('name')?.onChange?.({ target: { value: input } });
    expect(mocks.states[8]).toEqual({ name: input });
    render();
    await mocks.submit?.();
    expect(mocks.create).toHaveBeenCalledWith({ name: expected });
  });
  it('retains the editor and displays API errors on duplicate creation', async () => {
    mocks.states[7] = 'create';
    mocks.states[8] = { name: 'Medicina interna' };
    mocks.create.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'La especialidad ya existe' } },
    });
    render();
    await mocks.submit?.();
    expect(mocks.states[7]).toBe('create');
    expect(render()).toContain('La especialidad ya existe');
  });

  it('deactivates and reactivates specialties', async () => {
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
    const query: SpecialtiesQuery = { page: 1, limit: 10, status: 'inactive', search: 'Medicina interna' };
    mocks.states[0] = query;
    mocks.states[3] = { query, refresh: 0 };
    render();
    mocks.pagination?.onChange({ page: 1, limit: 25 });
    expect(render()).toContain('Cargando especialidades');
    mocks.listPage.mockResolvedValueOnce(makePage([], 1, 25));
    mocks.effect?.();
    await vi.waitFor(() => expect(mocks.states[3]).toEqual({ query: mocks.states[0], refresh: 0 }));
    expect(mocks.listPage).toHaveBeenCalledWith({ page: 1, limit: 25, status: 'inactive', search: 'Medicina interna' });
    expect(render()).toContain('No se encontraron especialidades.');
    expect(render()).toContain('0–0 de 0');
  });

  it('does not request the list or save after permissions are revoked', async () => {
    mocks.denied.add('specialty.get-all');
    expect(render()).toContain('No tienes permiso');
    mocks.effect?.();
    expect(mocks.listPage).not.toHaveBeenCalled();
    mocks.denied.delete('specialty.get-all');
    mocks.denied.add('specialty.update');
    mocks.states[7] = base;
    mocks.states[8] = { name: 'Nueva' };
    render();
    await mocks.submit?.();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
