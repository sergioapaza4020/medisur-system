import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorsAdministration from './DoctorsAdministration';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effect: null as (() => void | (() => void)) | null,
  buttons: new Map<string, { disabled?: boolean; onClick?: () => void }>(),
  pagination: null as ComponentProps<typeof ListPagination> | null,
  denied: new Set<string>(),
  list: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
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
    Dialog: ({ open, children }: ComponentProps<typeof actual.Dialog>) => (open ? <>{children}</> : null),
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
vi.mock('./DoctorSpecialtiesDialog', () => ({
  default: ({ idDoctor }: { idDoctor: number }) => <span>Editar asignaciones {idDoctor}</span>,
}));
vi.mock('@/services/doctors/doctorsService', () => ({
  doctorsService: { list: mocks.list, deactivate: mocks.deactivate, reactivate: mocks.reactivate },
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
const query = { page: 1, limit: 10, status: 'all', search: '' };
const doctor = {
  idDoctor: 1,
  isActive: true,
  user: { idUser: 4, name: 'Ana', lastname: 'Pérez', email: 'ana@example.com', ci: '123', isActive: true },
  specialties: [{ idSpecialty: 1, name: 'Cardiología', isActive: false }],
};
const page = { data: [doctor], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };
function render() {
  mocks.index = 0;
  mocks.effect = null;
  mocks.buttons.clear();
  return renderToStaticMarkup(<DoctorsAdministration />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.pagination = null;
  mocks.states = [query, '', page, { query, refresh: 0 }, 0, null, null, null, false, null, null];
  mocks.list.mockResolvedValue(page);
  mocks.deactivate.mockResolvedValue(undefined);
  mocks.reactivate.mockResolvedValue(undefined);
});
describe('Doctor administration', () => {
  it('opens the assignment editor only with assignment and catalog grants', () => {
    render();
    mocks.buttons.get('Asignar especialidades')?.onClick?.();
    expect(render()).toContain('Editar asignaciones 1');
    mocks.states[10] = null;
    mocks.denied.add('doctor.assign-specialties');
    expect(render()).not.toContain('Asignar especialidades');
    mocks.denied.delete('doctor.assign-specialties');
    mocks.denied.add('specialty.get-all');
    expect(render()).not.toContain('Asignar especialidades');
  });
  it('denies listing without permission and hides creation and deactivation without grants', () => {
    mocks.denied.add('doctor.get-all');
    expect(render()).toContain('No tienes permiso para consultar médicos');
    mocks.effect?.();
    expect(mocks.list).not.toHaveBeenCalled();
    mocks.denied.delete('doctor.get-all');
    mocks.denied.add('doctor.create');
    mocks.denied.add('doctor.delete');
    const html = render();
    expect(html).toContain('Ana');
    expect(html).toContain('Cardiología (inactiva)');
    expect(html).not.toContain('Registrar médico');
    expect(html).not.toContain('Desactivar');
  });

  it('confirms deactivation and reactivation, preserving errors and checking permissions again', async () => {
    render();
    mocks.buttons.get('Desactivar')?.onClick?.();
    render();
    mocks.deactivate.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    mocks.buttons.get('Confirmar')?.onClick?.();
    await flush();
    expect(mocks.states[7]).toEqual(doctor);
    expect(render()).toContain('No disponible');
    mocks.denied.add('doctor.delete');
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await flush();
    expect(mocks.deactivate).toHaveBeenCalledTimes(1);
    mocks.denied.delete('doctor.delete');
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await flush();
    expect(mocks.states[7]).toBeNull();
    mocks.states[7] = { ...doctor, isActive: false };
    render();
    mocks.buttons.get('Confirmar')?.onClick?.();
    await flush();
    expect(mocks.reactivate).toHaveBeenCalledWith(1);
  });

  it('disables reactivation when the linked account is inactive', () => {
    mocks.states[2] = { ...page, data: [{ ...doctor, isActive: false, user: { ...doctor.user, isActive: false } }] };
    render();
    expect(mocks.buttons.get('Activar')?.disabled).toBe(true);
  });

  it('uses shared pagination with loading, empty results and API retry', async () => {
    render();
    mocks.pagination?.onChange({ page: 1, limit: 25 });
    expect(render()).toContain('Cargando médicos');
    mocks.list.mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } });
    mocks.effect?.();
    await flush();
    expect(mocks.list).toHaveBeenCalledWith({ ...query, limit: 25 });
    expect(render()).toContain('No se encontraron médicos');
    mocks.list.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    mocks.effect?.();
    await flush();
    expect(render()).toContain('Reintentar');
    mocks.buttons.get('Reintentar')?.onClick?.();
    expect(mocks.states[4]).toBe(1);
  });
});
