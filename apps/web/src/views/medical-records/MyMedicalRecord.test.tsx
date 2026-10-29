import type { ComponentProps, ReactNode } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MyMedicalRecord from './MyMedicalRecord';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  allowed: true,
  idUser: 7 as number | undefined,
  mine: vi.fn(),
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
          typeof value === 'function' ? (value as (current: unknown) => unknown)(mocks.states[index]) : value;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) => {
    mocks.effects.push(effect);
  },
}));
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ user: mocks.idUser ? { idUser: mocks.idUser } : null, hasPermission: () => mocks.allowed }),
}));
vi.mock('@/services/medical-records/medicalRecordsService', () => ({ medicalRecordsService: { mine: mocks.mine } }));
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
    CircularProgress: (props: { 'aria-label': string }) => <span>{props['aria-label']}</span>,
    Divider: () => <hr />,
  };
});
const encounter = {
  occurredAt: '2026-10-01T13:00:00Z',
  summary: 'PRIVATE-OWN-CLINICAL',
  doctor: { name: 'Ana', lastname: 'Doctor' },
  specialty: { name: 'General' },
};
const page = { data: [encounter], meta: { page: 1, limit: 10, total: 11, totalPages: 2 } };
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  mocks.pagination = null;
  return renderToStaticMarkup(<MyMedicalRecord />);
}
function effect() {
  return mocks.effects.at(-1)?.();
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function load() {
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
  mocks.mine.mockResolvedValue(page);
});

describe('Patient own medical history', () => {
  it('does not request or display clinical content without permission', () => {
    mocks.allowed = false;
    expect(render()).toContain('No tienes permiso');
    effect();
    expect(mocks.mine).not.toHaveBeenCalled();
  });
  it('requires an authenticated account', () => {
    mocks.idUser = undefined;
    expect(render()).toContain('No tienes permiso');
    effect();
    expect(mocks.mine).not.toHaveBeenCalled();
  });
  it('shows loading until the request finishes and requests only pagination', async () => {
    expect(render()).toContain('Cargando mi historial clínico');
    expect(render()).not.toContain('PRIVATE-OWN-CLINICAL');
    effect();
    await flush();
    expect(mocks.mine).toHaveBeenCalledExactlyOnceWith({ page: 1, limit: 10 });
    const html = render();
    for (const text of ['Mi historial clínico', 'PRIVATE-OWN-CLINICAL', 'Ana', 'General', '9:00', 'Bolivia'])
      expect(html).toContain(text);
    expect(mocks.pagination?.meta).toEqual(page.meta);
  });
  it('shows a clear empty history and hides pagination', async () => {
    mocks.mine.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    await load();
    const html = render();
    expect(html).toContain('Aún no tienes atenciones');
    expect(html).not.toContain('Paginación común');
  });
  it('paginates through the common component and clears old content during a request', async () => {
    const cleanup = await load();
    render();
    mocks.pagination!.onChange({ page: 2, limit: 10 });
    if (cleanup) cleanup();
    expect(render()).toContain('Cargando mi historial');
    expect(render()).not.toContain('PRIVATE-OWN-CLINICAL');
    effect();
    await flush();
    expect(mocks.mine).toHaveBeenLastCalledWith({ page: 2, limit: 10 });
  });
  it('supports updating the history without keeping the prior clinical page visible', async () => {
    const cleanup = await load();
    render();
    mocks.buttons.get('Actualizar historial')!();
    if (cleanup) cleanup();
    expect(render()).not.toContain('PRIVATE-OWN-CLINICAL');
    effect();
    await flush();
    expect(mocks.mine).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403])('handles %s access denial without showing data or offering retry', async (status) => {
    mocks.mine.mockRejectedValue({ isAxiosError: true, response: { status, data: { message: 'Access denied' } } });
    await load();
    const html = render();
    expect(html).toContain('No tienes autorización');
    expect(html).not.toContain('PRIVATE-OWN-CLINICAL');
    expect(mocks.buttons.has('Reintentar')).toBe(false);
  });
  it('allows retry after a network failure', async () => {
    mocks.mine.mockRejectedValueOnce(new Error('offline'));
    const cleanup = await load();
    expect(render()).toContain('role="alert"');
    mocks.buttons.get('Reintentar')!();
    if (cleanup) cleanup();
    render();
    effect();
    await flush();
    expect(render()).toContain('PRIVATE-OWN-CLINICAL');
  });
  it('does not display the previous page after an API failure', async () => {
    const cleanup = await load();
    render();
    mocks.pagination!.onChange({ page: 2, limit: 10 });
    if (cleanup) cleanup();
    mocks.mine.mockRejectedValueOnce(new Error('offline'));
    render();
    effect();
    await flush();
    expect(render()).toContain('role="alert"');
    expect(render()).not.toContain('PRIVATE-OWN-CLINICAL');
  });
  it('hides prior account information immediately on account change or permission revocation', async () => {
    const cleanup = await load();
    expect(render()).toContain('PRIVATE-OWN-CLINICAL');
    if (cleanup) cleanup();
    mocks.idUser = 8;
    expect(render()).not.toContain('PRIVATE-OWN-CLINICAL');
    mocks.allowed = false;
    expect(render()).not.toContain('PRIVATE-OWN-CLINICAL');
  });
  it('ignores late responses after changing accounts or leaving the page', async () => {
    let resolve!: (value: unknown) => void;
    mocks.mine.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const cleanup = await load();
    if (cleanup) cleanup();
    mocks.idUser = 8;
    resolve(page);
    await flush();
    expect(mocks.states[2]).toBeNull();
    expect(render()).not.toContain('PRIVATE-OWN-CLINICAL');
  });
  it('escapes clinical text rather than interpreting it as HTML', async () => {
    mocks.mine.mockResolvedValue({
      ...page,
      data: [{ ...encounter, summary: '<script>alert(1)</script>', idEncounter: 99999, createdBy: 'TECHNICAL-AUTHOR' }],
    });
    await load();
    const html = render();
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('99999');
    expect(html).not.toContain('TECHNICAL-AUTHOR');
  });
  it('recovers when a requested page no longer exists, including when the history becomes empty', async () => {
    mocks.states[0] = { page: 3, limit: 10 };
    mocks.mine.mockResolvedValue({ data: [], meta: { page: 3, limit: 10, total: 0, totalPages: 0 } });
    await load();
    expect(mocks.states[0]).toEqual({ page: 1, limit: 10 });
  });
});
