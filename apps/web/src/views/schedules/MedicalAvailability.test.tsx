import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MedicalAvailability from './MedicalAvailability';
import AvailabilityCalendar from './AvailabilityCalendar';
import AvailabilitySlots from './AvailabilitySlots';
import { boliviaToday, monthDates, moveMonth } from './availabilityDates';
import type DoctorsBySpecialty from '@/views/doctors/DoctorsBySpecialty';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  denied: new Set<string>(),
  availability: vi.fn(),
  select: null as null | ComponentProps<typeof DoctorsBySpecialty>['onSelectDoctor'],
  calendar: null as null | ComponentProps<typeof AvailabilityCalendar>,
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 5) return [typeof initial === 'function' ? (initial as () => unknown)() : initial, vi.fn()];
      if (!(index in mocks.states))
        mocks.states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
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
vi.mock('./AvailabilityCalendar', async (original) => {
  const actual = await original<{ default: typeof AvailabilityCalendar }>();
  return {
    default: (props: ComponentProps<typeof AvailabilityCalendar>) => {
      mocks.calendar = props;
      return <actual.default {...props} />;
    },
  };
});
const doctor = { idDoctor: 3, name: 'Ana', lastname: 'Pérez' };
const specialty = { idSpecialty: 2, name: 'Cardiología' };
const block = {
  idSchedule: 9,
  idDoctor: 3,
  idSpecialty: 2,
  date: '2026-11-02',
  startTime: '09:00:00',
  endTime: '11:15:00',
  timeZone: 'America/La_Paz' as const,
};
function render() {
  mocks.index = 0;
  mocks.effects = [];
  return renderToStaticMarkup(<MedicalAvailability />);
}
async function load() {
  render();
  const cleanup = mocks.effects[0]();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  return cleanup;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.select = null;
  mocks.calendar = null;
  mocks.states = [{ doctor, specialty }, '2026-11', '', null, 0];
  mocks.availability.mockResolvedValue({ data: [], meta: { totalPages: 0 } });
});
describe('Medical availability calendar', () => {
  it.each(['schedule.get-availability', 'doctor.get-by-specialty'])('requires %s', (permission) => {
    mocks.denied.add(permission);
    expect(render()).toContain('No tienes permiso');
    mocks.effects.forEach((effect) => effect());
    expect(mocks.availability).not.toHaveBeenCalled();
  });
  it('prompts for a doctor without displaying a calendar or requesting availability', () => {
    mocks.states[0] = null;
    expect(render()).toContain('Selecciona un médico');
    expect(mocks.calendar).toBeNull();
    mocks.effects[0]();
    expect(mocks.availability).not.toHaveBeenCalled();
  });
  it('loads a month in one range request and displays empty feedback', async () => {
    expect(render()).toContain('Consultando disponibilidad');
    await load();
    expect(mocks.availability).toHaveBeenCalledExactlyOnceWith({
      idDoctor: 3,
      idSpecialty: 2,
      from: '2026-11-01',
      to: '2026-11-30',
      page: 1,
      limit: 100,
    });
    expect(render()).toContain('No hay horarios disponibles');
  });
  it('marks available dates and displays only the selected day with exact interval boundaries', async () => {
    mocks.availability.mockResolvedValue({
      data: [block, { ...block, idSchedule: 10, date: '2026-11-03' }],
      meta: { totalPages: 1 },
    });
    await load();
    expect(render()).toContain('2 de noviembre de 2026, disponible');
    mocks.calendar?.onSelect(block.date);
    const html = render();
    expect(html).toContain('09:00–11:15');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('Reservar');
    expect(mocks.availability).toHaveBeenCalledTimes(1);
  });
  it('loads subsequent pages without dropping available days', async () => {
    mocks.availability
      .mockResolvedValueOnce({ data: [], meta: { totalPages: 2 } })
      .mockResolvedValueOnce({ data: [block], meta: { totalPages: 2 } });
    await load();
    expect(mocks.availability).toHaveBeenCalledTimes(2);
    expect(render()).toContain('2 de noviembre de 2026, disponible');
  });
  it('does not duplicate the initial request when Strict Mode replays the effect', async () => {
    render();
    const cleanup = mocks.effects[0]();
    if (typeof cleanup === 'function') cleanup();
    mocks.effects[0]();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(mocks.availability).toHaveBeenCalledTimes(1);
  });
  it('refreshes when the same doctor is selected again instead of remaining in loading', async () => {
    await load();
    render();
    mocks.select?.(doctor, specialty);
    expect(render()).toContain('Consultando disponibilidad');
    await load();
    expect(mocks.availability).toHaveBeenCalledTimes(2);
    expect(render()).toContain('No hay horarios disponibles');
  });
  it('changes month and clears the selected date and stale intervals immediately', async () => {
    mocks.availability.mockResolvedValue({ data: [block], meta: { totalPages: 1 } });
    await load();
    render();
    mocks.calendar?.onSelect(block.date);
    mocks.calendar?.onMonthChange(1);
    expect(mocks.states[1]).toBe('2026-12');
    expect(mocks.states[2]).toBe('');
    expect(render()).not.toContain('09:00–11:15');
    await load();
    expect(mocks.availability).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-12-01', to: '2026-12-31' }),
    );
  });
  it('clears availability after changing doctor or specialty and ignores an obsolete request', async () => {
    render();
    const cleanup = mocks.effects[0]();
    mocks.select?.(null, specialty);
    if (typeof cleanup === 'function') cleanup();
    await Promise.resolve();
    expect(render()).toContain('Selecciona un médico');
    expect(mocks.states[3]).toBeNull();
    mocks.select?.({ ...doctor, idDoctor: 8 }, specialty);
    await load();
    expect(mocks.availability).toHaveBeenLastCalledWith(expect.objectContaining({ idDoctor: 8 }));
  });
  it('shows error feedback without stale availability', async () => {
    mocks.availability.mockRejectedValue(new Error('offline'));
    await load();
    expect(render()).toContain('No fue posible consultar la disponibilidad');
    expect(render()).toContain('Reintentar');
    expect(render()).not.toContain('No hay horarios disponibles');
  });
  it('disables past and unavailable days and previous months with accessible labels', () => {
    const html = renderToStaticMarkup(
      <AvailabilityCalendar
        month='2026-11'
        today='2026-11-02'
        dates={new Set(['2026-11-01', '2026-11-02'])}
        selectedDate='2026-11-02'
        loading={false}
        onSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />,
    );
    expect(html).toContain('1 de noviembre de 2026, fecha pasada');
    expect(html).toContain('3 de noviembre de 2026, sin disponibilidad');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toMatch(/disabled=""[^>]*aria-label="Mes anterior"/);
  });
  it('renders several blocks without inventing fixed duration slots', () => {
    const html = renderToStaticMarkup(
      <AvailabilitySlots
        date={block.date}
        blocks={[block, { ...block, idSchedule: 10, startTime: '14:00', endTime: '16:45' }]}
      />,
    );
    expect(html).toContain('09:00–11:15');
    expect(html).toContain('14:00–16:45');
    expect(html).not.toContain('09:30');
  });
  it('handles leap years, year changes and Bolivia midnight independently of browser timezone', () => {
    expect(monthDates('2028-02')).toMatchObject({ days: 29, to: '2028-02-29' });
    expect(moveMonth('2026-12', 1)).toBe('2027-01');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z'));
    expect(boliviaToday()).toBe('2026-10-31');
    vi.useRealTimers();
  });
});
