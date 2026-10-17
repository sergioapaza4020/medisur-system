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
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof ReactModule>();
  return {
    ...actual,
    useEffect: vi.fn(),
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 11) return [initial, vi.fn()];
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
vi.mock('@/services/schedules/schedulesService', () => ({ schedulesService: { create: mocks.create } }));
const specialties = {
  data: [{ idSpecialty: 2, name: 'Cardiología' }],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
};
function render() {
  mocks.states[6] = { query: mocks.states[0], refresh: 0 };
  mocks.index = 0;
  return renderToStaticMarkup(<ScheduleRegistration />);
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
});
