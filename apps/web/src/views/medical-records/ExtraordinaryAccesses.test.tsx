import type { ComponentProps, ReactNode } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExtraordinaryAccesses from './ExtraordinaryAccesses';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  allowed: true,
  idUser: 7,
  list: vi.fn(),
  create: null as null | (() => void),
  revoke: null as null | (() => void),
  readCount: 0,
  buttons: new Map<string, () => void>(),
  pagination: null as null | ComponentProps<typeof ListPagination>,
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
          typeof value === 'function' ? (value as (old: unknown) => unknown)(mocks.states[index]) : value;
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
vi.mock('@/services/medical-records/medicalRecordsService', () => ({ medicalRecordsService: { grants: mocks.list } }));
vi.mock('./ExtraordinaryGrantActions', () => ({
  CreateGrant: ({ onCreated }: { onCreated: () => void }) => {
    mocks.create = onCreated;
    return <button>Conceder</button>;
  },
  RevokeGrant: ({ onRevoked }: { onRevoked: () => void }) => {
    mocks.revoke = onRevoked;
    return <button>Revocar</button>;
  },
}));
vi.mock('@/views/appointments/DoctorMedicalRecord', () => ({
  ExtraordinaryMedicalRecord: () => {
    mocks.readCount++;
    return <button>Consultar historial</button>;
  },
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
    Card: Container,
    CardContent: Container,
    Stack: Container,
    Typography: Container,
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
    Chip: ({ label }: { label: string }) => <span>{label}</span>,
    CircularProgress: (props: { 'aria-label': string }) => <span>{props['aria-label']}</span>,
    Divider: () => <hr />,
  };
});
const grant = {
  idGrant: 9,
  patient: { idUser: 2, name: 'Luis', lastname: 'Patient', ci: '123' },
  beneficiary: { idUser: 7, name: 'Ana', lastname: 'Doctor' },
  type: 'EMERGENCY',
  reason: 'Situación de emergencia',
  expiresAt: '2099-01-01T13:00:00Z',
  state: 'ACTIVE',
  revokedAt: null,
  revocationReason: null,
};
const page = { data: [grant], meta: { page: 1, limit: 10, total: 11, totalPages: 2 } };
function render(mode: 'manage' | 'mine' = 'manage') {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  mocks.pagination = null;
  return renderToStaticMarkup(<ExtraordinaryAccesses mode={mode} />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function load(mode: 'manage' | 'mine' = 'manage') {
  render(mode);
  const cleanup = mocks.effects.at(-1)?.();
  await flush();
  return cleanup;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.effects = [];
  mocks.allowed = true;
  mocks.idUser = 7;
  mocks.create = null;
  mocks.revoke = null;
  mocks.readCount = 0;
  mocks.list.mockResolvedValue(page);
});
describe('Extraordinary access administration and beneficiary views', () => {
  it.each(['manage', 'mine'] as const)('requires its own permission for %s', (mode) => {
    mocks.allowed = false;
    expect(render(mode)).toContain('No tienes permiso');
    expect(mocks.effects).toHaveLength(0);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('lets managers see authorization metadata and revoke, but never mounts a clinical read', async () => {
    await load();
    const html = render();
    for (const text of ['Luis', 'Ana', 'Emergencia', 'Vigente', 'Revocar']) expect(html).toContain(text);
    expect(mocks.readCount).toBe(0);
    expect(mocks.create).not.toBeNull();
    expect(mocks.revoke).not.toBeNull();
    expect(mocks.list).toHaveBeenCalledWith({ page: 1, limit: 10 }, 'manage');
  });
  it('provides reading for the beneficiary without concession or revocation controls', async () => {
    await load('mine');
    const html = render('mine');
    expect(html).toContain('Consultar historial');
    expect(html).not.toContain('Conceder');
    expect(html).not.toContain('Revocar');
    expect(mocks.list).toHaveBeenCalledWith({ page: 1, limit: 10 }, 'mine');
  });
  it('uses common pagination and hides the previous result while loading', async () => {
    const cleanup = await load();
    render();
    mocks.pagination!.onChange({ page: 2, limit: 10 });
    if (cleanup) cleanup();
    expect(render()).toContain('Cargando autorizaciones');
    expect(render()).not.toContain('Luis');
    mocks.effects.at(-1)?.();
    await flush();
    expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, limit: 10 }, 'manage');
  });
  it('reloads metadata after concession and revocation with success feedback', async () => {
    await load();
    render();
    mocks.create!();
    render();
    mocks.effects.at(-1)?.();
    await flush();
    expect(render()).toContain('Autorización concedida correctamente');
    mocks.revoke!();
    render();
    mocks.effects.at(-1)?.();
    await flush();
    expect(render()).toContain('Autorización revocada correctamente');
  });
  it.each(['REVOKED', 'EXPIRED'])('preserves %s grants without offering revocation', async (state) => {
    mocks.list.mockResolvedValue({
      ...page,
      data: [{ ...grant, state, revocationReason: state === 'REVOKED' ? 'Autorización retirada' : null }],
    });
    await load();
    expect(render()).not.toContain('Revocar');
    expect(mocks.revoke).toBeNull();
  });
  it('handles empty results and recoverable errors', async () => {
    mocks.list.mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    await load();
    expect(render()).toContain('No hay autorizaciones');
    mocks.buttons.get('Actualizar autorizaciones')!();
    mocks.list.mockRejectedValueOnce(new Error('offline'));
    render();
    mocks.effects.at(-1)?.();
    await flush();
    expect(render()).toContain('role="alert"');
    mocks.buttons.get('Reintentar')!();
    render();
    mocks.effects.at(-1)?.();
    await flush();
    expect(render()).toContain('Luis');
  });
  it('does not retain another account or mode response or apply late results', async () => {
    let resolve!: (value: unknown) => void;
    mocks.list.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const cleanup = await load();
    if (cleanup) cleanup();
    mocks.idUser = 8;
    resolve(page);
    await flush();
    expect(render()).not.toContain('Luis');
    expect(render('mine')).not.toContain('Luis');
    mocks.allowed = false;
    expect(render()).not.toContain('Luis');
  });
});
