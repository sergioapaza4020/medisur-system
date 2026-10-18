import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MedicalAvailability from './MedicalAvailability';
import type DoctorsBySpecialty from '@/views/doctors/DoctorsBySpecialty';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  denied: new Set<string>(),
  availability: vi.fn(),
  submit: null as null | (() => void),
  select: null as null | ComponentProps<typeof DoctorsBySpecialty>['onSelectDoctor'],
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
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (typeof props.children === 'string') mocks.buttons.set(props.children, props.onClick as () => void);
      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ hasPermission: (name: string) => !mocks.denied.has(name) }),
}));
vi.mock('@/services/schedules/schedulesService', () => ({ schedulesService: { availability: mocks.availability } }));
vi.mock('@/views/doctors/DoctorsBySpecialty', () => ({
  default: (props: ComponentProps<typeof DoctorsBySpecialty>) => {
    mocks.select = props.onSelectDoctor;
    return <span>Selector existente</span>;
  },
}));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination = props;
    return <span>Paginación común</span>;
  },
}));
const doctor = { idDoctor: 3, name: 'Ana', lastname: 'Pérez' };
const specialty = { idSpecialty: 2, name: 'Cardiología' };
const query = { idDoctor: 3, idSpecialty: 2, date: '2026-11-02', page: 1, limit: 10 };
const empty = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  return renderToStaticMarkup(<MedicalAvailability />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.select = null;
  mocks.submit = null;
  mocks.pagination = null;
  mocks.states = [{ doctor, specialty }, query.date, null, null, null, 0, ''];
  mocks.availability.mockResolvedValue(empty);
});
describe('Medical availability', () => {
  it.each(['schedule.get-availability', 'doctor.get-by-specialty'])(
    'requires %s before rendering or requesting data',
    (permission) => {
      mocks.denied.add(permission);
      expect(render()).toContain('No tienes permiso');
      mocks.effects.forEach((effect) => effect());
      expect(mocks.availability).not.toHaveBeenCalled();
      expect(mocks.select).toBeNull();
    },
  );
  it('consults the selected doctor, specialty and date and displays a valid empty result', async () => {
    render();
    mocks.submit?.();
    expect(render()).toContain('Consultando disponibilidad');
    mocks.effects[0]();
    await flush();
    expect(mocks.availability).toHaveBeenCalledWith(query);
    expect(render()).toContain('No hay disponibilidad');
    expect(mocks.pagination?.meta.total).toBe(0);
  });
  it('shows intervals and paginates with the shared component', async () => {
    mocks.availability.mockResolvedValue({
      data: [{ idSchedule: 9, date: query.date, startTime: '09:00:00', endTime: '10:00:00' }],
      meta: { page: 1, limit: 10, total: 12, totalPages: 2 },
    });
    mocks.states[2] = query;
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('09:00');
    expect(render()).toContain('10:00');
    mocks.pagination?.onChange({ page: 2, limit: 5 });
    render();
    mocks.effects[0]();
    await flush();
    expect(mocks.availability).toHaveBeenLastCalledWith({ ...query, page: 2, limit: 5 });
  });
  it.each(['2026-02-30', '0000-01-01'])('rejects invalid date %s without consulting the API', (date) => {
    mocks.states[1] = date;
    render();
    mocks.submit?.();
    expect(render()).toContain('Selecciona una fecha válida');
    expect(mocks.availability).not.toHaveBeenCalled();
  });
  it('shows API errors and offers retry', async () => {
    mocks.availability.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Fecha inválida' } } });
    mocks.states[2] = query;
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('Fecha inválida');
    mocks.buttons.get('Reintentar')?.();
    expect(mocks.states[5]).toBe(1);
  });
  it('clears results when the selector changes and ignores obsolete requests', async () => {
    mocks.states[2] = query;
    render();
    const cleanup = mocks.effects[0]();
    mocks.select?.(null, specialty);
    if (typeof cleanup === 'function') cleanup();
    await flush();
    expect(mocks.states[0]).toBeNull();
    expect(mocks.states[2]).toBeNull();
    expect(mocks.states[3]).toBeNull();
    expect(render()).toContain('Selecciona un médico');
  });
});
