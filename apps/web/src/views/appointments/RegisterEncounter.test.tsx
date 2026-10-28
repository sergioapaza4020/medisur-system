import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RegisterEncounter from './RegisterEncounter';
import type { DoctorAppointment } from '@/types/doctor-agenda';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  allowed: true,
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  create: vi.fn(),
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
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ user: { idUser: 2 }, hasPermission: () => mocks.allowed }),
}));
vi.mock('@/services/encounters/encountersService', () => ({ encountersService: { create: mocks.create } }));
vi.mock('@mui/material', () => ({
  TextField: ({ label }: { label: string }) => <input aria-label={label} />,
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
const appointment: DoctorAppointment = {
  idAppointment: 9,
  patient: { name: 'Ana', lastname: 'Pérez' },
  specialty: { name: 'Cardiología' },
  date: '2000-01-01',
  startTime: '09:00:00',
  endTime: '10:00:00',
  status: 'RESERVED',
  timeZone: 'America/La_Paz',
};
function render(value: DoctorAppointment | undefined = appointment) {
  mocks.index = 0;
  return renderToStaticMarkup(<RegisterEncounter appointment={value} />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.buttons.clear();
  mocks.inFlight.current = false;
  mocks.allowed = true;
});
describe('Clinical encounter form', () => {
  it('hides the action without clinical permission', () => {
    mocks.allowed = false;
    expect(render()).toBe('');
  });
  it.each(['CANCELLED', 'RESCHEDULED'])('hides the action for %s appointments', (status) => {
    expect(render({ ...appointment, status: status as 'RESERVED' })).toBe('');
  });
  it('hides future appointments', () => {
    expect(render({ ...appointment, date: '2099-01-01' })).toBe('');
  });
  it('displays the appointment context and validates the required summary', () => {
    mocks.states[0] = true;
    expect(render()).toContain('Ana');
    mocks.buttons.get('Guardar atención')!.onClick();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(render()).toContain('Escribe un resumen');
  });
  it('prevents double submissions, shows loading and clears clinical text on success', async () => {
    let resolve!: (value: unknown) => void;
    mocks.create.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mocks.states[0] = true;
    mocks.states[1] = ' Resumen ';
    render();
    mocks.buttons.get('Guardar atención')!.onClick();
    mocks.buttons.get('Guardar atención')!.onClick();
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ idAppointment: 9, summary: 'Resumen' });
    expect(render()).toContain('Guardando');
    expect(mocks.buttons.get('Guardando…')!.disabled).toBe(true);
    resolve({ idEncounter: 1 });
    await flush();
    expect(render()).toContain('Atención registrada correctamente');
    expect(mocks.states[1]).toBe('');
    expect(mocks.states[0]).toBe(false);
  });
  it('preserves input on failure and permits retry without reporting success', async () => {
    mocks.create.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Sin autorización' } },
    });
    mocks.states[0] = true;
    mocks.states[1] = 'Resumen';
    render();
    mocks.buttons.get('Guardar atención')!.onClick();
    await flush();
    expect(render()).toContain('Sin autorización');
    expect(mocks.states[1]).toBe('Resumen');
    expect(mocks.buttons.get('Guardar atención')!.disabled).toBe(false);
    expect(render()).not.toContain('Atención registrada correctamente');
  });
  it('validates a patient and specialty for encounters without an appointment', async () => {
    mocks.states[0] = true;
    mocks.states[1] = 'Resumen';
    mocks.index = 0;
    renderToStaticMarkup(<RegisterEncounter />);
    mocks.buttons.get('Guardar atención')!.onClick();
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.states[2] = '5';
    mocks.states[3] = '7';
    mocks.index = 0;
    renderToStaticMarkup(<RegisterEncounter />);
    mocks.create.mockResolvedValue({ idEncounter: 1 });
    mocks.buttons.get('Guardar atención')!.onClick();
    await flush();
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ idPatient: 5, idSpecialty: 7, summary: 'Resumen' });
  });
});
