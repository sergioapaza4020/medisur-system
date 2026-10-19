import type { ComponentProps, ReactNode } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProposeRescheduling from './ProposeRescheduling';
import PatientProposals from './PatientProposals';
import type AvailabilitySlots from '@/views/schedules/AvailabilitySlots';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  fields: new Map<string, { onChange: (event: { target: { value: string } }) => void }>(),
  slots: null as null | ComponentProps<typeof AvailabilitySlots>,
  pagination: null as null | ComponentProps<typeof ListPagination>,
  available: vi.fn(),
  propose: vi.fn(),
  proposals: vi.fn(),
  result: vi.fn(),
  flight: { current: false },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = mocks.index++;
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
  useRef: () => mocks.flight,
  useEffect: (effect: () => void | (() => void)) => {
    mocks.effects.push(effect);
  },
}));
vi.mock('@mui/material', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Stack: Container,
    DialogActions: Container,
    DialogContent: Container,
    DialogTitle: Container,
    Typography: Container,
    Alert: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
      <div role='alert'>
        {children}
        {action}
      </div>
    ),
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
    Button: (props: { children: string; disabled?: boolean; onClick: () => void }) => {
      mocks.buttons.set(String(props.children), props);
      return <button disabled={props.disabled}>{props.children}</button>;
    },
    TextField: (props: { label: string; onChange: (event: { target: { value: string } }) => void }) => {
      mocks.fields.set(props.label, props);
      return <input aria-label={props.label} />;
    },
    Chip: ({ label }: { label: string }) => <span>{label}</span>,
    CircularProgress: (props: { 'aria-label': string }) => <span>{props['aria-label']}</span>,
  };
});
vi.mock('@/views/schedules/AvailabilitySlots', () => ({
  default: (props: ComponentProps<typeof AvailabilitySlots>) => {
    mocks.slots = props;
    return <div>Horarios disponibles</div>;
  },
}));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination = props;
    return <div>Paginación</div>;
  },
}));
vi.mock('@/services/appointments/appointmentsService', () => ({
  appointmentsService: {
    reschedulingAvailability: mocks.available,
    proposeRescheduling: mocks.propose,
    patientProposals: mocks.proposals,
  },
}));
const appointment = {
  idAppointment: 9,
  patient: { name: 'Ana', lastname: 'Pérez' },
  specialty: { name: 'Cardiología' },
  date: '2099-11-02',
  startTime: '09:00',
  endTime: '10:00',
  status: 'CANCELLED' as const,
  timeZone: 'America/La_Paz' as const,
};
const block = {
  idSchedule: 4,
  version: 2,
  idDoctor: 3,
  idSpecialty: 1,
  date: '2099-11-03',
  startTime: '11:00',
  endTime: '12:00',
  timeZone: 'America/La_Paz' as const,
};
const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
function render(patient = false) {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  return renderToStaticMarkup(
    patient ? (
      <PatientProposals idAppointment={9} />
    ) : (
      <ProposeRescheduling appointment={appointment} onResult={mocks.result} />
    ),
  );
}
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
async function load(patient = false) {
  render(patient);
  mocks.effects[0]();
  await flush();
  return render(patient);
}
async function open(patient = false) {
  render(patient);
  mocks.buttons.get(patient ? 'Ver propuestas' : 'Proponer reprogramación')!.onClick();
  return load(patient);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.flight.current = false;
  mocks.slots = null;
  mocks.pagination = null;
  mocks.available.mockResolvedValue({ data: [block], meta });
  mocks.propose.mockResolvedValue({ idProposal: 1, status: 'PENDING' });
  mocks.proposals.mockResolvedValue({
    data: [
      {
        idProposal: 1,
        originalDate: '2099-11-02',
        originalStartTime: '09:00',
        originalEndTime: '10:00',
        date: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        status: 'PENDING',
      },
    ],
    meta,
  });
});
describe('Doctor proposal', () => {
  it('loads only after opening and requires explicit schedule selection and confirmation', async () => {
    render();
    mocks.effects[0]();
    expect(mocks.available).not.toHaveBeenCalled();
    const html = await open();
    expect(html).toContain('Ana');
    expect(html).toContain('Original:');
    expect(html).toContain('ni reserva el horario');
    expect(mocks.buttons.get('Confirmar propuesta')!.disabled).toBe(true);
    mocks.slots!.onSelect!(block);
    render();
    mocks.buttons.get('Confirmar propuesta')!.onClick();
    await flush();
    expect(mocks.propose).toHaveBeenCalledExactlyOnceWith(9, block);
    expect(mocks.result).toHaveBeenCalledWith(true, expect.stringContaining('Propuesta pendiente creada'));
  });
  it('prevents double submission and disables closing controls while saving', async () => {
    let resolve!: () => void;
    mocks.propose.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    await open();
    mocks.slots!.onSelect!(block);
    render();
    mocks.buttons.get('Confirmar propuesta')!.onClick();
    mocks.buttons.get('Confirmar propuesta')!.onClick();
    expect(mocks.propose).toHaveBeenCalledTimes(1);
    expect(render()).toContain('Creando propuesta');
    expect(mocks.buttons.get('Volver')!.disabled).toBe(true);
    resolve();
    await flush();
  });
  it('refreshes availability and clears a conflicting selection without claiming success', async () => {
    await open();
    mocks.slots!.onSelect!(block);
    render();
    mocks.propose.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'El horario ya no está disponible' }, status: 409 },
    });
    mocks.buttons.get('Confirmar propuesta')!.onClick();
    await flush();
    expect(render()).toContain('El horario ya no está disponible');
    expect(mocks.result).not.toHaveBeenCalled();
    expect(mocks.buttons.get('Confirmar propuesta')!.disabled).toBe(true);
    await load();
    expect(mocks.available).toHaveBeenCalledTimes(2);
  });
  it('handles loading, empty availability, errors and retry', async () => {
    render();
    mocks.buttons.get('Proponer reprogramación')!.onClick();
    expect(render()).toContain('Consultando horarios');
    mocks.available.mockRejectedValue(new Error('network'));
    expect(await load()).toContain('Ha ocurrido un error');
    mocks.available.mockResolvedValue({ data: [], meta: { ...meta, total: 0, totalPages: 0 } });
    mocks.buttons.get('Reintentar')!.onClick();
    expect(await load()).toContain('No hay horarios');
  });
  it('uses common pagination and clears the selection when the date or page changes', async () => {
    await open();
    mocks.slots!.onSelect!(block);
    render();
    mocks.pagination!.onChange({ page: 2, limit: 10 });
    await load();
    expect(mocks.available).toHaveBeenLastCalledWith(9, expect.objectContaining({ page: 2, limit: 10 }));
    expect(mocks.buttons.get('Confirmar propuesta')!.disabled).toBe(true);
    mocks.fields.get('Nueva fecha')!.onChange({ target: { value: '2099-11-03' } });
    await load();
    expect(mocks.available).toHaveBeenLastCalledWith(9, { page: 1, limit: 10, date: '2099-11-03' });
  });
});
describe('Patient proposal consultation', () => {
  it('shows original and new time with pending state and common pagination', async () => {
    const html = await open(true);
    for (const text of ['Pendiente', 'Original:', 'Propuesta:', '2099-11-02', '2099-11-03', '09:00', '11:00'])
      expect(html).toContain(text);
    expect(mocks.proposals).toHaveBeenCalledWith(9, { page: 1, limit: 10 });
    mocks.pagination!.onChange({ page: 2, limit: 10 });
    await load(true);
    expect(mocks.proposals).toHaveBeenLastCalledWith(9, { page: 2, limit: 10 });
  });
  it('handles loading, error and no proposals', async () => {
    render(true);
    mocks.buttons.get('Ver propuestas')!.onClick();
    expect(render(true)).toContain('Cargando propuestas');
    mocks.proposals.mockRejectedValue(new Error('network'));
    expect(await load(true)).toContain('Ha ocurrido un error');
    mocks.proposals.mockResolvedValue({ data: [], meta: { ...meta, total: 0, totalPages: 0 } });
    mocks.buttons.get('Reintentar')!.onClick();
    expect(await load(true)).toContain('No tienes propuestas');
  });
  it.each([
    ['ACCEPTED', 'Aceptada'],
    ['REJECTED', 'Rechazada'],
  ])('renders persisted state %s', async (status, label) => {
    mocks.proposals.mockResolvedValue({
      data: [
        {
          idProposal: 1,
          status,
          originalDate: block.date,
          originalStartTime: '09:00',
          originalEndTime: '10:00',
          date: block.date,
          startTime: '11:00',
          endTime: '12:00',
        },
      ],
      meta,
    });
    expect(await open(true)).toContain(label);
  });
  it('ignores obsolete responses after leaving the dialog', async () => {
    let resolve!: (page: unknown) => void;
    mocks.proposals.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(true);
    mocks.buttons.get('Ver propuestas')!.onClick();
    render(true);
    const cleanup = mocks.effects[0]();
    if (typeof cleanup === 'function') cleanup();
    resolve({ data: [], meta });
    await flush();
    expect(mocks.states[3]).toBe(null);
  });
});
