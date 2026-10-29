import type { ComponentProps, ReactNode } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorMedicalRecord, { ExtraordinaryMedicalRecord } from './DoctorMedicalRecord';
import type { ExtraordinaryGrant } from '@/types/medical-records';
import type ListPagination from '@/components/pagination/ListPagination';
import type { DoctorAppointment } from '@/types/doctor-agenda';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  allowed: true,
  idUser: 7,
  read: vi.fn(),
  extraRead: vi.fn(),
  buttons: new Map<string, () => void>(),
  pagination: null as null | ComponentProps<typeof ListPagination>,
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
}));
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ user: { idUser: mocks.idUser }, hasPermission: () => mocks.allowed }),
}));
vi.mock('@/services/medical-records/medicalRecordsService', () => ({
  medicalRecordsService: { byAppointment: mocks.read, byExtraordinaryGrant: mocks.extraRead },
}));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination = props;
    return <div>Paginación común</div>;
  },
}));
vi.mock('@mui/material', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Stack: Container,
    Typography: Container,
    DialogTitle: Container,
    DialogActions: Container,
    DialogContent: Container,
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
    Alert: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
      <div role='alert'>
        {children}
        {action}
      </div>
    ),
    Button: ({ children, onClick }: { children: string; onClick: () => void }) => {
      mocks.buttons.set(children, onClick);
      return <button>{children}</button>;
    },
    CircularProgress: (props: { 'aria-label': string }) => <span>{props['aria-label']}</span>,
    Divider: () => <hr />,
  };
});
const appointment: DoctorAppointment = {
  idAppointment: 9,
  patient: { name: 'Luis', lastname: 'Patient' },
  specialty: { name: 'General' },
  status: 'RESERVED',
  canReadMedicalRecord: true,
  date: '2099-01-01',
  startTime: '09:00:00',
  endTime: '10:00:00',
  timeZone: 'America/La_Paz',
};
const encounter = {
  idEncounter: 4,
  occurredAt: '2026-10-01T13:00:00Z',
  summary: 'PRIVATE-CLINICAL',
  doctor: { name: 'Ana', lastname: 'Doctor' },
  specialty: { name: 'General' },
};
const page = { data: [encounter], meta: { page: 1, limit: 10, total: 11, totalPages: 2 } };
function render(value = appointment) {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  return renderToStaticMarkup(<DoctorMedicalRecord appointment={value} />);
}
function effect() {
  return mocks.effects.at(-1)?.();
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function open() {
  render();
  mocks.buttons.get('Consultar historial')!();
  render();
  const cleanup = effect();
  await flush();
  return cleanup;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.buttons.clear();
  mocks.effects = [];
  mocks.allowed = true;
  mocks.idUser = 7;
  mocks.pagination = null;
  mocks.read.mockResolvedValue(page);
  mocks.extraRead.mockResolvedValue(page);
});

describe('Doctor clinical history dialog', () => {
  it('hides the action without clinical permission', () => {
    mocks.allowed = false;
    expect(render()).toBe('');
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(['CANCELLED', 'RESCHEDULED'])('hides the action for %s appointments', (status) => {
    expect(render({ ...appointment, status: status as 'RESERVED' })).toBe('');
  });
  it.each([false, undefined])('hides the action without server eligibility %s', (canReadMedicalRecord) => {
    expect(render({ ...appointment, canReadMedicalRecord })).toBe('');
  });
  it('loads only on request and displays context, clinical content and Bolivia time', async () => {
    expect(render()).not.toContain('PRIVATE-CLINICAL');
    effect();
    expect(mocks.read).not.toHaveBeenCalled();
    await open();
    const html = render();
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(9, { page: 1, limit: 10 });
    for (const text of ['Luis', 'PRIVATE-CLINICAL', 'Ana', 'General', '9:00', 'Bolivia']) expect(html).toContain(text);
    expect(mocks.pagination?.meta).toEqual(page.meta);
  });
  it('uses common pagination and hides previous page content while loading the next', async () => {
    await open();
    render();
    mocks.pagination!.onChange({ page: 2, limit: 10 });
    expect(render()).toContain('Cargando historial');
    expect(render()).not.toContain('PRIVATE-CLINICAL');
    effect();
    await flush();
    expect(mocks.read).toHaveBeenLastCalledWith(9, { page: 2, limit: 10 });
  });
  it('shows an empty history', async () => {
    mocks.read.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    await open();
    expect(render()).toContain('aún no tiene atenciones');
    expect(render()).not.toContain('Paginación común');
  });
  it('handles denied access without retaining clinical content or offering a misleading retry', async () => {
    mocks.read.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'No clinical access' } },
    });
    await open();
    const html = render();
    expect(html).toContain('Acceso al historial denegado');
    expect(html).not.toContain('PRIVATE-CLINICAL');
    expect(mocks.buttons.has('Reintentar')).toBe(false);
  });
  it('allows retry after a network failure', async () => {
    mocks.read.mockRejectedValueOnce(new Error('offline'));
    await open();
    expect(render()).toContain('role="alert"');
    mocks.buttons.get('Reintentar')!();
    render();
    effect();
    await flush();
    expect(render()).toContain('PRIVATE-CLINICAL');
  });
  it('clears content on close and fetches again on reopening', async () => {
    const cleanup = await open();
    render();
    mocks.buttons.get('Cerrar historial')!();
    if (cleanup) cleanup();
    expect(render()).not.toContain('PRIVATE-CLINICAL');
    expect(mocks.states[3]).toBeNull();
    mocks.buttons.get('Consultar historial')!();
    render();
    effect();
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it('ignores late responses after closing', async () => {
    let resolve!: (value: unknown) => void;
    mocks.read.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const cleanup = await open();
    render();
    mocks.buttons.get('Cerrar historial')!();
    if (cleanup) cleanup();
    resolve(page);
    await flush();
    expect(mocks.states[3]).toBeNull();
    expect(render()).not.toContain('PRIVATE-CLINICAL');
  });
  it('hides the previous account and patient data immediately on context or permission changes', async () => {
    const cleanup = await open();
    expect(render()).toContain('PRIVATE-CLINICAL');
    if (cleanup) cleanup();
    mocks.idUser = 8;
    expect(render()).not.toContain('PRIVATE-CLINICAL');
    mocks.idUser = 7;
    expect(render({ ...appointment, idAppointment: 10 })).not.toContain('PRIVATE-CLINICAL');
    mocks.allowed = false;
    expect(render()).toBe('');
  });
  it('renders summaries as text rather than HTML', async () => {
    mocks.read.mockResolvedValue({ ...page, data: [{ ...encounter, summary: '<script>alert(1)</script>' }] });
    await open();
    const html = render();
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('recovers when a requested page no longer exists', async () => {
    mocks.states[0] = true;
    mocks.states[1] = { page: 3, limit: 10 };
    mocks.read.mockResolvedValue({ data: [], meta: { page: 3, limit: 10, total: 1, totalPages: 1 } });
    render();
    effect();
    await flush();
    expect(mocks.states[1]).toEqual({ page: 1, limit: 10 });
  });
});

describe('Extraordinary clinical dialog', () => {
  const grant: ExtraordinaryGrant = {
    idGrant: 9,
    patient: { idUser: 2, name: 'Luis', lastname: 'Patient', ci: '123' },
    beneficiary: { idUser: 7, name: 'Ana', lastname: 'Doctor' },
    type: 'EMERGENCY',
    reason: 'Situación de emergencia',
    createdAt: '2026-10-29T12:00:00Z',
    expiresAt: '2026-10-29T13:00:00Z',
    revokedAt: null,
    revocationReason: null,
    state: 'ACTIVE',
  };
  function renderGrant(value = grant) {
    mocks.index = 0;
    mocks.effects = [];
    mocks.buttons.clear();
    return renderToStaticMarkup(<ExtraordinaryMedicalRecord grant={value} />);
  }
  it('does not render for managers without read permission or for other beneficiaries', () => {
    mocks.allowed = false;
    expect(renderGrant()).toBe('');
    mocks.allowed = true;
    mocks.idUser = 8;
    expect(renderGrant()).toBe('');
    expect(mocks.extraRead).not.toHaveBeenCalled();
  });
  it.each(['REVOKED', 'EXPIRED'])('does not render clinical access for a %s grant', (state) => {
    expect(renderGrant({ ...grant, state: state as 'ACTIVE' })).toBe('');
  });
  it('uses only the grant route and removes clinical content at the expiry boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:59:59Z'));
    const cleanups: (() => void)[] = [];
    try {
      renderGrant();
      mocks.buttons.get('Consultar historial')!();
      renderGrant();
      for (const callback of mocks.effects) {
        const cleanup = callback();
        if (cleanup) cleanups.push(cleanup);
      }
      await flush();
      expect(renderGrant()).toContain('PRIVATE-CLINICAL');
      expect(mocks.extraRead).toHaveBeenCalledExactlyOnceWith(9, { page: 1, limit: 10 });
      expect(mocks.read).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1001);
      const html = renderGrant();
      expect(html).toContain('autorización extraordinaria venció');
      expect(html).not.toContain('PRIVATE-CLINICAL');
      expect(mocks.states[3]).toBeNull();
    } finally {
      for (const cleanup of cleanups) cleanup();
      vi.useRealTimers();
    }
  });
});
