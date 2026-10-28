import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import type * as MuiModule from '@mui/material';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorAgenda from './DoctorAgenda';
import { agendaPeriod, navigateAgenda, periodDays, positionEvents } from './agendaDates';
import type { DoctorAppointment } from '@/types/doctor-agenda';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  wide: true,
  allowed: true,
  idUser: 7,
  agenda: vi.fn(),
  buttons: new Map<string, () => void>(),
  fields: new Map<string, ComponentProps<typeof MuiModule.TextField>>(),
  viewChange: null as null | ((event: unknown, value: string) => void),
  dialog: false,
  canCancel: true,
  canPropose: true,
  cancellation: null as null | { mode: string; onResult: (success: boolean, message: string) => void },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = mocks.index++;
    if (!(i in mocks.states)) mocks.states[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      mocks.states[i],
      (value: unknown) => {
        mocks.states[i] =
          typeof value === 'function' ? (value as (current: unknown) => unknown)(mocks.states[i]) : value;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) => {
    mocks.effects.push(effect);
  },
  useMemo: (factory: () => unknown) => factory(),
}));
vi.mock('@mui/material', async (original) => {
  const actual = await original<typeof MuiModule>();
  return {
    ...actual,
    useMediaQuery: () => mocks.wide,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      mocks.buttons.set(String(props['aria-label'] ?? props.children), props.onClick as () => void);
      return <actual.Button {...props} />;
    },
    TextField: (props: ComponentProps<typeof actual.TextField>) => {
      mocks.fields.set(String(props.label), props);
      return <actual.TextField {...props} />;
    },
    ToggleButtonGroup: (props: ComponentProps<typeof actual.ToggleButtonGroup>) => {
      mocks.viewChange = props.onChange as typeof mocks.viewChange;
      return <actual.ToggleButtonGroup {...props} />;
    },
    Dialog: (props: ComponentProps<typeof actual.Dialog>) => {
      mocks.dialog = props.open;
      return props.open ? <div>{props.children}</div> : null;
    },
  };
});
vi.mock('./PatientProposals', () => ({ default: () => <button>Ver propuestas</button> }));
vi.mock('./RegisterEncounter', () => ({ default: () => <button>Registrar atención</button> }));
vi.mock('./ProposeRescheduling', () => ({ default: () => <button>Proponer reprogramación</button> }));
vi.mock('./CancelAppointment', () => ({
  default: (props: { mode: string; onResult: (success: boolean, message: string) => void }) => {
    mocks.cancellation = props;
    return <button>Cancelar cita</button>;
  },
}));
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({
    user: { idUser: mocks.idUser },
    hasPermission: (permission: string) =>
      permission === 'appointment.cancel-as-doctor'
        ? mocks.canCancel
        : permission === 'appointment.propose-rescheduling'
          ? mocks.canPropose
          : mocks.allowed,
  }),
}));
vi.mock('@/services/appointments/appointmentsService', () => ({ appointmentsService: { agenda: mocks.agenda } }));
vi.mock('@/views/schedules/availabilityDates', async (original) => ({
  ...(await original<object>()),
  boliviaToday: () => '2026-10-19',
}));
const event = {
  idAppointment: 1,
  date: '2026-10-19',
  startTime: '09:00:00',
  endTime: '09:30:00',
  patient: { name: 'Ana', lastname: 'Pérez', ci: 'SECRET-CI' },
  specialty: { name: 'Cardiología' },
  status: 'RESERVED',
  timeZone: 'America/La_Paz',
};
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  return renderToStaticMarkup(<DoctorAgenda />);
}
async function load() {
  render();
  mocks.effects[1]();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  return render();
}
function changeView(view: string) {
  render();
  mocks.viewChange?.({}, view);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.wide = true;
  mocks.allowed = true;
  mocks.idUser = 7;
  mocks.canCancel = true;
  mocks.canPropose = true;
  mocks.cancellation = null;
  mocks.agenda.mockResolvedValue({ data: [event] });
});
describe('Medical calendar', () => {
  it('defaults to week on desktop, uses a single complete range query and renders time grid', async () => {
    const html = await load();
    expect(html).toContain('Calendario semanal por horas');
    expect(html).toContain('Ana');
    expect(html).not.toContain('SECRET-CI');
    expect(mocks.agenda).toHaveBeenCalledExactlyOnceWith({
      from: '2026-10-19',
      to: '2026-10-25',
      mode: 'calendar',
      page: 1,
      limit: 100,
      status: undefined,
    });
  });
  it('defaults to day on mobile and uses grouped list for week', async () => {
    mocks.wide = false;
    expect(await load()).toContain('09:00–09:30');
    expect(mocks.agenda).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-19', to: '2026-10-19' }));
    changeView('week');
    const html = await load();
    expect(html).toContain('Sin citas');
    expect(html).not.toContain('Calendario semanal por horas');
  });
  it('changes views without losing the reference date and opens a month day', async () => {
    changeView('month');
    await load();
    expect(mocks.agenda).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-01', to: '2026-10-31' }));
    mocks.buttons.get('Ver día 2026-10-19, 1 citas')?.();
    await load();
    expect(mocks.agenda).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-19', to: '2026-10-19' }));
  });
  it('navigates previous, next and today keeping view', async () => {
    await load();
    mocks.buttons.get('Periodo siguiente')?.();
    await load();
    expect(mocks.agenda).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-26', to: '2026-11-01' }));
    mocks.buttons.get('Periodo anterior')?.();
    await load();
    expect(mocks.states[1]).toBe('2026-10-19');
    mocks.buttons.get('Periodo anterior')?.();
    await load();
    mocks.buttons.get('Hoy')?.();
    await load();
    expect(mocks.states[1]).toBe('2026-10-19');
  });
  it('gates cancellation separately and refreshes the current calendar with feedback', async () => {
    await load();
    mocks.buttons.get([...mocks.buttons.keys()].find((value) => value.includes('Ana Pérez'))!)?.();
    mocks.canCancel = false;
    expect(render()).not.toContain('Cancelar cita');
    mocks.canCancel = true;
    expect(render()).toContain('Cancelar cita');
    expect(mocks.cancellation?.mode).toBe('doctor');
    mocks.cancellation?.onResult(true, 'Cita cancelada correctamente');
    const html = await load();
    expect(html).toContain('Cita cancelada correctamente');
    expect(mocks.states[4]).toBe(null);
    expect(mocks.states[3]).toBe(1);
    expect(mocks.agenda).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-19', to: '2026-10-25' }));
    mocks.idUser = 8;
    expect(render()).not.toContain('Cita cancelada correctamente');
  });
  it('offers a proposal only for cancelled appointments with the specific permission', async () => {
    mocks.agenda.mockResolvedValue({ data: [{ ...event, status: 'CANCELLED' }] });
    await load();
    mocks.buttons.get([...mocks.buttons.keys()].find((value) => value.includes('Ana Pérez'))!)?.();
    expect(render()).toContain('Proponer reprogramación');
    mocks.canPropose = false;
    expect(render()).not.toContain('Proponer reprogramación');
  });
  it('opens an operational summary when a visit is selected', async () => {
    await load();
    const key = [...mocks.buttons.keys()].find((value) => value.includes('Ana Pérez'));
    mocks.buttons.get(key!)?.();
    const html = render();
    expect(mocks.dialog).toBe(true);
    expect(html).toContain('Resumen de cita');
    expect(html).not.toContain('SECRET-CI');
  });
  it.each([
    ['day', 'para este día'],
    ['week', 'esta semana'],
    ['month', 'este mes'],
  ])('shows empty %s state', async (view, text) => {
    mocks.agenda.mockResolvedValue({ data: [] });
    changeView(view);
    expect(await load()).toContain(text);
  });
  it('shows loading, errors and retry', async () => {
    expect(render()).toContain('Cargando agenda médica');
    mocks.agenda.mockRejectedValue(new Error('failure'));
    const html = await load();
    expect(html).toContain('Ha ocurrido un error inesperado');
    expect(mocks.buttons.has('Reintentar')).toBe(true);
    mocks.buttons.get('Reintentar')?.();
    expect(render()).toContain('Cargando agenda médica');
  });
  it('hides previous account data and ignores obsolete responses', async () => {
    await load();
    mocks.idUser = 8;
    expect(render()).not.toContain('Ana');
    const cleanup = mocks.effects[1]();
    if (typeof cleanup === 'function') cleanup();
    const previous = mocks.states[6];
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(mocks.states[6]).toBe(previous);
  });
  it('does not fetch without permission', () => {
    mocks.allowed = false;
    expect(render()).toContain('No tienes permiso');
    mocks.effects[1]();
    expect(mocks.agenda).not.toHaveBeenCalled();
  });
  it('keeps state filters in range requests and hides previous events while loading', async () => {
    await load();
    mocks.fields
      .get('Estado')
      ?.onChange?.({ target: { value: 'CANCELLED' } } as ReactModule.ChangeEvent<HTMLInputElement>);
    expect(render()).not.toContain('Ana');
    await load();
    expect(mocks.agenda).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'CANCELLED', mode: 'calendar' }));
  });
  it('places appointments in their actual day and does not show them on a different date', async () => {
    mocks.wide = false;
    changeView('week');
    mocks.agenda.mockResolvedValue({
      data: [event, { ...event, idAppointment: 2, date: '2026-10-21', patient: { name: 'Luis', lastname: 'Vargas' } }],
    });
    const html = await load();
    expect(html.indexOf('Ana')).toBeLessThan(html.indexOf('martes, 20'));
    expect(html.indexOf('Luis')).toBeGreaterThan(html.indexOf('miércoles, 21'));
    mocks.buttons.get('Periodo siguiente')?.();
    expect(render()).not.toContain('Luis');
  });
  it('never reopens a summary from the previous account after a new response', async () => {
    await load();
    mocks.buttons.get([...mocks.buttons.keys()].find((value) => value.includes('Ana Pérez'))!)?.();
    render();
    expect(mocks.dialog).toBe(true);
    mocks.idUser = 8;
    mocks.agenda.mockResolvedValue({ data: [] });
    await load();
    expect(mocks.dialog).toBe(false);
    expect(render()).not.toContain('Ana');
  });
  it.each(['CANCELLED', 'RESCHEDULED'])('shows real status %s without sensitive data', async (status) => {
    mocks.agenda.mockResolvedValue({ data: [{ ...event, status }] });
    const html = await load();
    expect(html).toContain(status === 'CANCELLED' ? 'Cancelada' : 'Reprogramada');
    expect(html).not.toContain('SECRET-CI');
  });
});
describe('Calendar dates', () => {
  it('shares width only between overlapping events, restoring full width afterwards', () => {
    const base = event as DoctorAppointment;
    const positioned = positionEvents([
      base,
      { ...base, idAppointment: 2, startTime: '09:15:00', endTime: '10:00:00' },
      { ...base, idAppointment: 3, startTime: '10:00:00', endTime: '10:30:00' },
    ]);
    expect(positioned.map(({ lane, columns }) => [lane, columns])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
  it('handles year boundaries and leap months without browser timezone conversion', () => {
    expect(agendaPeriod('2027-01-01', 'week')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    expect(agendaPeriod('2028-02-15', 'month')).toMatchObject({ from: '2028-02-01', to: '2028-02-29' });
    expect(navigateAgenda('2028-01-31', 'month', 1)).toBe('2028-02-29');
    expect(periodDays('2026-10-19', '2026-10-25')).toHaveLength(7);
  });
});
