import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CancelAppointment from './CancelAppointment';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  cancelMine: vi.fn(),
  cancelAsDoctor: vi.fn(),
  inFlight: { current: false },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useRef: () => mocks.inFlight,
  useState: (initial: unknown) => {
    const index = mocks.index++;
    if (!(index in mocks.states))
      mocks.states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = value;
      },
    ];
  },
}));
vi.mock('@mui/material', () => ({
  TextField: () => <input aria-label='Motivo de cancelación' />,
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
vi.mock('@/services/appointments/appointmentsService', () => ({
  appointmentsService: { cancelMine: mocks.cancelMine, cancelAsDoctor: mocks.cancelAsDoctor },
}));
const appointment = {
  idAppointment: 9,
  doctor: { name: 'Ana', lastname: 'Pérez' },
  specialty: { name: 'Cardiología' },
  date: '2099-11-02',
  startTime: '09:00:00',
  endTime: '10:00:00',
  status: 'RESERVED' as const,
  timeZone: 'America/La_Paz' as const,
};
const result = vi.fn();
function render(value = appointment) {
  mocks.index = 0;
  return renderToStaticMarkup(<CancelAppointment appointment={value} onResult={result} />);
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
describe('Patient cancellation confirmation', () => {
  it('requires explicit confirmation and displays the doctor, specialty, date and hour', () => {
    expect(render()).not.toContain('Confirmar cancelación');
    mocks.buttons.get('Cancelar cita')!.onClick();
    const html = render();
    for (const value of ['Confirmar cancelación', 'Ana', 'Cardiología', '09:00', '10:00'])
      expect(html).toContain(value);
    expect(mocks.cancelMine).not.toHaveBeenCalled();
    mocks.buttons.get('Volver')!.onClick();
    expect(mocks.states[0]).toBe(false);
  });
  it('prevents double submission and reports success for list refresh', async () => {
    let resolve!: (value: unknown) => void;
    mocks.cancelMine.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mocks.states[0] = true;
    render();
    mocks.buttons.get('Confirmar cancelación')!.onClick();
    mocks.buttons.get('Confirmar cancelación')!.onClick();
    expect(mocks.cancelMine).toHaveBeenCalledExactlyOnceWith(9);
    expect(render()).toContain('Cancelando');
    expect(mocks.buttons.get('Cancelando…')?.disabled).toBe(true);
    resolve({ status: 'CANCELLED' });
    await flush();
    expect(result).toHaveBeenCalledWith(true, expect.stringContaining('Cita cancelada correctamente'));
    expect(mocks.states[0]).toBe(false);
  });
  it('refreshes after a state conflict and exposes clear error feedback without claiming success', async () => {
    mocks.states[0] = true;
    render();
    mocks.cancelMine.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'La cita ya no puede cancelarse' } },
    });
    mocks.buttons.get('Confirmar cancelación')!.onClick();
    await flush();
    expect(result).toHaveBeenCalledWith(false, 'La cita ya no puede cancelarse');
    expect(mocks.states[0]).toBe(false);
  });
  it('keeps error feedback and allows retry for network failures', async () => {
    mocks.states[0] = true;
    render();
    mocks.cancelMine.mockRejectedValue(new Error('offline'));
    mocks.buttons.get('Confirmar cancelación')!.onClick();
    await flush();
    expect(render()).toContain('role="alert"');
    expect(result).not.toHaveBeenCalled();
    expect(mocks.buttons.get('Confirmar cancelación')?.disabled).toBe(false);
  });
  it('does not offer cancellation for a past appointment', () => {
    expect(render({ ...appointment, date: '2000-01-01' })).toBe('');
  });
  it.each(['CANCELLED', 'RESCHEDULED'])('does not offer cancellation for %s', (status) => {
    expect(render({ ...appointment, status: status as 'RESERVED' })).toBe('');
  });
});

describe('Doctor cancellation confirmation', () => {
  const doctorAppointment = {
    idAppointment: appointment.idAppointment,
    specialty: appointment.specialty,
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    timeZone: appointment.timeZone,
    patient: { name: 'Luis', lastname: 'Vargas' },
  };
  function renderDoctor() {
    mocks.index = 0;
    return renderToStaticMarkup(<CancelAppointment appointment={doctorAppointment} mode='doctor' onResult={result} />);
  }
  it('requires a reason and explicit confirmation before calling the doctor endpoint', async () => {
    mocks.states[0] = true;
    const html = renderDoctor();
    expect(html).toContain('Motivo de cancelación');
    expect(html).toContain('Luis');
    mocks.buttons.get('Confirmar cancelación')!.onClick();
    expect(mocks.cancelAsDoctor).not.toHaveBeenCalled();
    expect(renderDoctor()).toContain('Indica un motivo');
    mocks.states[4] = '  Urgencia médica  ';
    renderDoctor();
    mocks.cancelAsDoctor.mockResolvedValue({ status: 'CANCELLED' });
    mocks.buttons.get('Confirmar cancelación')!.onClick();
    await flush();
    expect(mocks.cancelAsDoctor).toHaveBeenCalledExactlyOnceWith(9, 'Urgencia médica');
    expect(mocks.cancelMine).not.toHaveBeenCalled();
    expect(result).toHaveBeenCalledWith(true, expect.stringContaining('Cita cancelada'));
  });
  it('preserves the reason and reports service errors without claiming success', async () => {
    mocks.states[0] = true;
    renderDoctor();
    mocks.states[4] = 'Urgencia';
    renderDoctor();
    mocks.cancelAsDoctor.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Sin permiso' } },
    });
    mocks.buttons.get('Confirmar cancelación')!.onClick();
    await flush();
    expect(renderDoctor()).toContain('Sin permiso');
    expect(mocks.states[4]).toBe('Urgencia');
    expect(result).not.toHaveBeenCalled();
  });
});
