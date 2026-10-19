import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ScheduleRegistration from './ScheduleRegistration';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  authorized: true,
  submit: null as null | (() => Promise<void>),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof ReactModule>();
  return {
    ...actual,
    useEffect: vi.fn(),
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 12) return [initial, vi.fn()];
      if (!(index in mocks.states)) mocks.states[index] = initial;
      return [
        mocks.states[index],
        (value: unknown) => {
          mocks.states[index] = value;
        },
      ];
    },
  };
});
vi.mock('@mui/material', async (original) => {
  const actual = await original<typeof MuiModule>();
  return {
    ...actual,
    Box: (props: ComponentProps<typeof actual.Box> & { component?: string }) => {
      if (props.component === 'form')
        mocks.submit = () => (props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault: vi.fn() });
      return <actual.Box {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({ useAuth: () => ({ hasPermission: () => mocks.authorized }) }));
vi.mock('@/services/schedules/schedulesService', () => ({
  schedulesService: { create: mocks.create, update: mocks.update },
}));
const specialties = {
  data: [{ idSpecialty: 2, name: 'Cardiología' }],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
};
function render(schedule?: ComponentProps<typeof ScheduleRegistration>['schedule']) {
  mocks.states[6] = { query: mocks.states[0], refresh: 0 };
  mocks.index = 0;
  return renderToStaticMarkup(<ScheduleRegistration schedule={schedule} />);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized = true;
  mocks.submit = null;
  mocks.states = [{ page: 1, limit: 10 }, specialties, '2', '2026-11-02', '09:00', '10:00', false, false, '', '', 0];
});
describe('Schedule registration form', () => {
  it('hides registration for users without permission', () => {
    mocks.authorized = false;
    expect(render()).toContain('No tienes permiso');
    expect(mocks.submit).toBeNull();
  });
  it('submits own schedule and displays success', async () => {
    render();
    await mocks.submit?.();
    expect(mocks.create).toHaveBeenCalledWith({
      idSpecialty: 2,
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '10:00',
    });
    expect(render()).toContain('Horario registrado correctamente');
  });
  it('rejects reversed times before contacting the API', async () => {
    mocks.states[4] = '11:00';
    render();
    await mocks.submit?.();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(render()).toContain('La hora de inicio debe ser anterior');
  });
  it('displays API overlap errors', async () => {
    mocks.create.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'El horario se solapa con otro bloque activo del médico' } },
    });
    render();
    await mocks.submit?.();
    expect(render()).toContain('El horario se solapa');
  });
  it('shows current values and submits a versioned modification using the existing form', async () => {
    const schedule = {
      idSchedule: 9,
      idDoctor: 3,
      idSpecialty: 2,
      specialtyName: 'Cardiología',
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '10:00',
      isActive: true,
      version: 4,
    };
    mocks.states[11] = false;
    expect(render(schedule)).toContain('Valores actuales');
    await mocks.submit?.();
    expect(mocks.update).toHaveBeenCalledWith(9, {
      idSpecialty: 2,
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '10:00',
      isActive: false,
      expectedVersion: 4,
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(render(schedule)).toContain('Horario modificado correctamente');
  });
  it('displays version conflict errors without silently overwriting changes', async () => {
    const schedule = {
      idSchedule: 9,
      idDoctor: 3,
      idSpecialty: 2,
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '10:00',
      isActive: true,
      version: 1,
    };
    mocks.update.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'El horario cambió. Recarga sus valores antes de modificarlo' } },
    });
    render(schedule);
    await mocks.submit?.();
    expect(render(schedule)).toContain('El horario cambió');
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});
