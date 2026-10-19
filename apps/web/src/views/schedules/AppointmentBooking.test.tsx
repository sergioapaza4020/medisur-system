import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppointmentBooking from './AppointmentBooking';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  create: vi.fn(),
  inFlight: { current: false },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useRef: () => mocks.inFlight,
  useState: (initial: unknown) => {
    const index = mocks.index++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = value;
      },
    ];
  },
}));
vi.mock('@mui/material', () => ({
  Button: (props: { children: string; disabled?: boolean; onClick: () => void }) => {
    mocks.buttons.set(String(props.children), props);
    return <button disabled={props.disabled}>{props.children}</button>;
  },
  Dialog: ({ open, children }: { open: boolean; children: ReactModule.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogActions: ({ children }: { children: ReactModule.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactModule.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactModule.ReactNode }) => <h2>{children}</h2>,
  Typography: ({ children }: { children: ReactModule.ReactNode }) => <p>{children}</p>,
  Alert: ({ children }: { children: ReactModule.ReactNode }) => <div role='alert'>{children}</div>,
}));
vi.mock('@/services/appointments/appointmentsService', () => ({ appointmentsService: { create: mocks.create } }));
const block = {
  idSchedule: 9,
  version: 2,
  idDoctor: 3,
  idSpecialty: 2,
  date: '2099-11-02',
  startTime: '09:00:00',
  endTime: '10:00:00',
  timeZone: 'America/La_Paz' as const,
};
const result = vi.fn();
function render() {
  mocks.index = 0;
  return renderToStaticMarkup(<AppointmentBooking block={block} onResult={result} />);
}
function open() {
  mocks.states[0] = true;
  return render();
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.buttons.clear();
  mocks.inFlight.current = false;
});
describe('Appointment confirmation', () => {
  it('does not reserve before explicit confirmation and displays the complete block', () => {
    expect(render()).not.toContain('Confirmar reserva de cita');
    expect(open()).toContain('09:00–10:00');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('prevents double submission, shows progress and reports success for availability refresh', async () => {
    let resolve!: (value: unknown) => void;
    mocks.create.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    open();
    mocks.buttons.get('Confirmar reserva')!.onClick();
    mocks.buttons.get('Confirmar reserva')!.onClick();
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(block);
    expect(render()).toContain('Reservando');
    expect(mocks.buttons.get('Reservando…')?.disabled).toBe(true);
    resolve({ idAppointment: 12 });
    await flush();
    expect(result).toHaveBeenCalledWith(true, expect.stringContaining('Cita #12 reservada'));
    expect(mocks.states[0]).toBe(false);
  });
  it.each([404, 409])('reports stale or occupied blocks (%s) and triggers refresh', async (status) => {
    mocks.create.mockRejectedValue({ isAxiosError: true, response: { status } });
    open();
    mocks.buttons.get('Confirmar reserva')!.onClick();
    await flush();
    expect(result).toHaveBeenCalledWith(false, expect.stringContaining('ya no está disponible'));
  });
  it('keeps clear error feedback for network failures without reporting success', async () => {
    mocks.create.mockRejectedValue(new Error('offline'));
    open();
    mocks.buttons.get('Confirmar reserva')!.onClick();
    await flush();
    expect(render()).toContain('No fue posible confirmar la reserva');
    expect(result).not.toHaveBeenCalled();
  });
});
