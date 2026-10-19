import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SchedulesManagement from './SchedulesManagement';
import type ScheduleRegistration from './ScheduleRegistration';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  denied: new Set<string>(),
  mine: vi.fn(),
  submit: null as null | (() => void),
  editor: null as null | ComponentProps<typeof ScheduleRegistration>,
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
vi.mock('@/services/schedules/schedulesService', () => ({ schedulesService: { mine: mocks.mine } }));
vi.mock('./ScheduleRegistration', () => ({
  default: (props: ComponentProps<typeof ScheduleRegistration>) => {
    mocks.editor = props;
    return <span>Selector existente</span>;
  },
}));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination = props;
    return <span>Paginación común</span>;
  },
}));
const query = { page: 1, limit: 10 };
const schedule = {
  idSchedule: 9,
  idDoctor: 3,
  idSpecialty: 2,
  specialtyName: 'Cardiología',
  date: '2026-11-02',
  startTime: '09:00',
  endTime: '10:00',
  isActive: false,
  version: 3,
};
const page = { data: [schedule], meta: { ...query, total: 12, totalPages: 2 } };
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  return renderToStaticMarkup(<SchedulesManagement />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.editor = null;
  mocks.pagination = null;
  mocks.states = [query, page, { query, refresh: 0 }, 0, '', null, ''];
  mocks.mine.mockResolvedValue(page);
});
describe('Own schedule management', () => {
  it('denies listing and requests without the update permission', () => {
    mocks.denied.add('schedule.update');
    expect(render()).toContain('No tienes permiso');
    mocks.effects.forEach((effect) => effect());
    expect(mocks.mine).not.toHaveBeenCalled();
  });
  it('shows inactive schedules and uses the common pagination component', async () => {
    expect(render()).toContain('Inactivo');
    mocks.pagination?.onChange({ page: 2, limit: 5 });
    expect(render()).toContain('Cargando mis horarios');
    mocks.effects[0]();
    await flush();
    expect(mocks.mine).toHaveBeenCalledWith({ page: 2, limit: 5 });
  });
  it('passes the complete current values to the reused form and refreshes after saving', () => {
    render();
    mocks.buttons.get('Modificar horario 9')?.();
    render();
    expect(mocks.editor?.schedule).toEqual(schedule);
    mocks.editor?.onSaved?.();
    expect(mocks.states[5]).toBeNull();
    expect(mocks.states[3]).toBe(1);
    expect(mocks.states[6]).toBe('Horario modificado correctamente');
  });
  it('reloads values when cancelling an outdated edit', () => {
    mocks.states[5] = schedule;
    render();
    mocks.editor?.onCancel?.();
    expect(mocks.states[5]).toBeNull();
    expect(mocks.states[3]).toBe(1);
  });
  it('handles empty results and error retries', async () => {
    mocks.mine.mockResolvedValueOnce({ data: [], meta: { ...query, total: 0, totalPages: 0 } });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('No tienes horarios registrados');
    mocks.mine.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Servicio no disponible' } } });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('Servicio no disponible');
    mocks.buttons.get('Reintentar')?.();
    expect(mocks.states[3]).toBe(1);
  });
  it('ignores obsolete list responses after unmount', async () => {
    render();
    const cleanup = mocks.effects[0]();
    if (typeof cleanup === 'function') cleanup();
    mocks.states[1] = null;
    await flush();
    expect(mocks.states[1]).toBeNull();
  });
});
