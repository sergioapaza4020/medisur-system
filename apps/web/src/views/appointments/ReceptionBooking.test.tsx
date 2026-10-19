import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReceptionBooking from './ReceptionBooking';
import type MedicalAvailability from '@/views/schedules/MedicalAvailability';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  idUser: 7,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  denied: new Set<string>(),
  patients: vi.fn(),
  availability: null as null | ComponentProps<typeof MedicalAvailability>,
  submit: null as null | (() => void),
  fields: new Map<string, ComponentProps<typeof MuiModule.TextField>>(),
  pagination: null as null | ComponentProps<typeof ListPagination>,
  buttons: new Map<string, () => void>(),
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 7) return [initial, vi.fn()];
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
vi.mock('@mui/material', async (original) => {
  const actual = await original<typeof MuiModule>();
  return {
    ...actual,
    Box: (props: ComponentProps<typeof actual.Box> & { component?: string }) => {
      if (props.component === 'form')
        mocks.submit = () => (props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
      return <actual.Box {...props} />;
    },
    TextField: (props: ComponentProps<typeof actual.TextField>) => {
      mocks.fields.set(String(props.label), props);
      return <actual.TextField {...props} />;
    },
    Button: (props: ComponentProps<typeof actual.Button>) => {
      const label = Array.isArray(props.children) ? props.children.join('') : String(props.children);
      mocks.buttons.set(label, props.onClick as () => void);
      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ user: { idUser: mocks.idUser }, hasPermission: (name: string) => !mocks.denied.has(name) }),
}));
vi.mock('@/services/appointments/appointmentsService', () => ({ appointmentsService: { patients: mocks.patients } }));
vi.mock('@/views/schedules/MedicalAvailability', () => ({
  default: (props: ComponentProps<typeof MedicalAvailability>) => {
    mocks.availability = props;
    return <span>Disponibilidad compartida</span>;
  },
}));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination = props;
    return <span>Paginación común</span>;
  },
}));
const query = { page: 1, limit: 10, search: 'Ana' };
const patient = { idUser: 9, name: 'Ana', lastname: 'Pérez', ci: '123456' };
const page = { data: [patient], meta: { page: 1, limit: 10, total: 12, totalPages: 2 } };
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  mocks.fields.clear();
  return renderToStaticMarkup(<ReceptionBooking />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.idUser = 7;
  mocks.pagination = null;
  mocks.availability = null;
  mocks.submit = null;
  mocks.states = ['Ana', query, page, { query, refresh: 0 }, 0, '', null];
  mocks.patients.mockResolvedValue(page);
});
describe('Reception booking', () => {
  it.each(['appointment.create-for-patient', 'schedule.get-availability', 'doctor.get-by-specialty'])(
    'requires %s before searching or displaying patients',
    (permission) => {
      mocks.denied.add(permission);
      expect(render()).toContain('No tienes los permisos');
      mocks.effects.forEach((effect) => effect());
      expect(mocks.patients).not.toHaveBeenCalled();
      expect(mocks.availability).toBeNull();
    },
  );
  it('does not perform an unbounded search or display booking without a selected patient', () => {
    mocks.states = ['', null, null, null, 0, '', null];
    render();
    mocks.effects[0]();
    mocks.submit?.();
    expect(mocks.patients).not.toHaveBeenCalled();
    expect(mocks.availability).toBeNull();
  });
  it('trims search and resets the page using common pagination', async () => {
    mocks.states[0] = ' Ana ';
    render();
    mocks.submit?.();
    render();
    mocks.effects[0]();
    await flush();
    expect(mocks.patients).toHaveBeenCalledWith(query);
    render();
    mocks.pagination?.onChange({ page: 2, limit: 5 });
    expect(render()).toContain('Buscando pacientes');
    expect(render()).not.toContain('Seleccionar paciente 123456');
    mocks.effects[0]();
    await flush();
    expect(mocks.patients).toHaveBeenLastCalledWith({ page: 2, limit: 5, search: 'Ana' });
  });
  it('displays the selected patient and passes the exact target to shared availability', () => {
    expect(render()).toContain('Paginación común');
    mocks.buttons.get('Seleccionar paciente 123456')?.();
    const html = render();
    expect(html).toContain('Ana');
    expect(html).toContain('123456');
    expect(html).toContain('en nombre de otro paciente');
    expect(mocks.availability?.bookingFor).toEqual(patient);
    mocks.buttons.get('Cambiar paciente')?.();
    expect(mocks.states[6]).toBeNull();
    expect(mocks.states[4]).toBe(1);
  });
  it('offers HU-USR-03 registration only with its existing permission', () => {
    expect(render()).toContain('/dashboard/patients/register');
    mocks.denied.add('user.create-patient');
    expect(render()).not.toContain('/dashboard/patients/register');
  });
  it('shows no matching active patients and allows an error retry', async () => {
    mocks.patients.mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('No se encontraron pacientes activos');
    mocks.patients.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Servicio no disponible' } },
    });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('Servicio no disponible');
    mocks.buttons.get('Reintentar búsqueda')?.();
    expect(mocks.states[4]).toBe(1);
  });
  it('ignores obsolete search responses', async () => {
    render();
    const cleanup = mocks.effects[0]();
    if (typeof cleanup === 'function') cleanup();
    mocks.states[2] = null;
    await flush();
    expect(mocks.states[2]).toBeNull();
  });
});
