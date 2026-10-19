import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MyAppointments from './MyAppointments';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  idUser: 7,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  denied: new Set<string>(),
  mine: vi.fn(),
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
      if (index >= 5) return [initial, vi.fn()];
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
    TextField: (props: ComponentProps<typeof actual.TextField>) => {
      mocks.fields.set(String(props.label), props);
      return <actual.TextField {...props} />;
    },
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (typeof props.children === 'string') mocks.buttons.set(props.children, props.onClick as () => void);
      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ user: { idUser: mocks.idUser }, hasPermission: (name: string) => !mocks.denied.has(name) }),
}));
vi.mock('@/services/appointments/appointmentsService', () => ({ appointmentsService: { mine: mocks.mine } }));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination = props;
    return <span>Paginación común</span>;
  },
}));
const query = { page: 1, limit: 10, period: 'upcoming' as const };
const appointment = {
  idAppointment: 9,
  doctor: { name: 'Ana', lastname: 'Pérez' },
  specialty: { name: 'Cardiología' },
  date: '2099-11-02',
  startTime: '09:00:00',
  endTime: '10:00:00',
  status: 'RESERVED',
  timeZone: 'America/La_Paz',
};
const page = { data: [appointment], meta: { page: 1, limit: 10, total: 12, totalPages: 2 } };
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  mocks.fields.clear();
  return renderToStaticMarkup(<MyAppointments />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function change(label: string, value: string) {
  const field = mocks.fields.get(label);
  field?.onChange?.({ target: { value } } as ReactModule.ChangeEvent<HTMLInputElement>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.idUser = 7;
  mocks.pagination = null;
  mocks.states = [query, page, { query, refresh: 0, idUser: 7 }, 0, ''];
  mocks.mine.mockResolvedValue(page);
});
describe('My appointments', () => {
  it('does not query or render patient data without permission', () => {
    mocks.denied.add('appointment.get-mine');
    expect(render()).toContain('No tienes permiso');
    mocks.effects.forEach((effect) => effect());
    expect(mocks.mine).not.toHaveBeenCalled();
  });
  it('displays the doctor, specialty, date, time and translated state', () => {
    const html = render();
    for (const value of ['Ana', 'Pérez', 'Cardiología', '2099-11-02', '09:00–10:00', 'Reservada'])
      expect(html).toContain(value);
    expect(html).toContain('Paginación común');
    expect(html).not.toContain('idPatient');
  });
  it('preserves filters through common pagination and hides stale rows while loading', async () => {
    render();
    mocks.pagination?.onChange({ page: 2, limit: 5 });
    expect(render()).toContain('Cargando mis citas');
    expect(render()).not.toContain('Ana');
    mocks.effects[0]();
    await flush();
    expect(mocks.mine).toHaveBeenCalledWith({ page: 2, limit: 5, period: 'upcoming' });
  });
  it.each([
    ['Periodo', 'past', 'period'],
    ['Estado', 'RESERVED', 'status'],
    ['Fecha', '2099-11-02', 'date'],
  ])('resets pagination and applies %s filter', async (label, value, key) => {
    mocks.states[0] = { ...query, page: 3 };
    render();
    change(label, value);
    render();
    mocks.effects[0]();
    await flush();
    expect(mocks.mine).toHaveBeenCalledWith(expect.objectContaining({ page: 1, [key]: value }));
  });
  it('clears optional date and state filters', () => {
    mocks.states[0] = { ...query, date: '2099-11-02', status: 'RESERVED' };
    render();
    change('Fecha', '');
    render();
    change('Estado', '');
    expect(mocks.states[0]).toMatchObject({ date: undefined, status: undefined, page: 1 });
  });
  it('handles an empty result', async () => {
    mocks.mine.mockResolvedValue({ data: [], meta: { ...query, total: 0, totalPages: 0 } });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('No tienes citas para los filtros seleccionados');
  });
  it('shows error feedback with retry and never retains stale patient rows', async () => {
    mocks.mine.mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Servicio no disponible' } } });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('Servicio no disponible');
    expect(render()).not.toContain('Ana');
    mocks.buttons.get('Reintentar')?.();
    expect(mocks.states[3]).toBe(1);
  });
  it('ignores obsolete responses after filter changes or unmount', async () => {
    render();
    const cleanup = mocks.effects[0]();
    if (typeof cleanup === 'function') cleanup();
    mocks.states[1] = null;
    await flush();
    expect(mocks.states[1]).toBeNull();
  });
  it('recovers when the requested page no longer exists', async () => {
    mocks.states[0] = { ...query, page: 3 };
    mocks.mine.mockResolvedValue({ data: [], meta: { page: 3, limit: 10, total: 0, totalPages: 0 } });
    render();
    mocks.effects[0]();
    await flush();
    expect(mocks.states[0]).toMatchObject({ page: 1 });
    expect(render()).toContain('Cargando mis citas');
  });
  it('hides the previous account data immediately when the authenticated identity changes', async () => {
    expect(render()).toContain('Ana');
    mocks.idUser = 8;
    expect(render()).toContain('Cargando mis citas');
    expect(render()).not.toContain('Ana');
    mocks.mine.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('No tienes citas para los filtros seleccionados');
    expect(mocks.states[2]).toMatchObject({ idUser: 8 });
  });
});
