import type { ComponentProps, ReactNode } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExtraordinaryPersonPicker from './ExtraordinaryPersonPicker';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  people: vi.fn(),
  selected: vi.fn(),
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  field: null as null | ((event: { target: { value: string } }) => void),
  pagination: null as null | ComponentProps<typeof ListPagination>,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = mocks.index++;
    if (!(i in mocks.states)) mocks.states[i] = initial;
    return [
      mocks.states[i],
      (value: unknown) => {
        mocks.states[i] = typeof value === 'function' ? (value as (old: unknown) => unknown)(mocks.states[i]) : value;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) => {
    mocks.effects.push(effect);
  },
}));
vi.mock('@/services/medical-records/medicalRecordsService', () => ({
  medicalRecordsService: { people: mocks.people },
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
    DialogContent: Container,
    DialogActions: Container,
    DialogTitle: Container,
    Typography: Container,
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
    TextField: ({ onChange }: { onChange: (event: { target: { value: string } }) => void }) => {
      mocks.field = onChange;
      return <input />;
    },
    Button: (props: { children: ReactNode; disabled?: boolean; onClick: () => void }) => {
      const text = Array.isArray(props.children) ? props.children.join('') : String(props.children);
      mocks.buttons.set(text, props);
      return <button disabled={props.disabled}>{props.children}</button>;
    },
    Alert: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
      <div role='alert'>
        {children}
        {action}
      </div>
    ),
    CircularProgress: () => <span>Cargando</span>,
  };
});
const person = { idUser: 2, name: 'Luis', lastname: 'Patient', ci: '123' };
const page = { data: [person], meta: { page: 1, limit: 10, total: 11, totalPages: 2 } };
function render(kind: 'patients' | 'beneficiaries' = 'patients') {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  return renderToStaticMarkup(
    <ExtraordinaryPersonPicker kind={kind} selected={null} onSelect={mocks.selected} disabled={false} />,
  );
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.people.mockResolvedValue(page);
  mocks.pagination = null;
});
describe('Scoped administrative person search', () => {
  it('requires an explicit search with at least three characters', () => {
    render();
    mocks.effects.at(-1)?.();
    expect(mocks.people).not.toHaveBeenCalled();
    mocks.buttons.get('Seleccionar paciente')!.onClick();
    render();
    expect(mocks.buttons.get('Buscar')!.disabled).toBe(true);
  });
  it.each(['patients', 'beneficiaries'] as const)(
    'uses the paginated %s endpoint and passes only the selected identity',
    async (kind) => {
      mocks.states[0] = true;
      render(kind);
      mocks.field!({ target: { value: 'Luis' } });
      render(kind);
      mocks.buttons.get('Buscar')!.onClick();
      render(kind);
      const cleanup = mocks.effects.at(-1)?.();
      await flush();
      render(kind);
      expect(mocks.people).toHaveBeenCalledExactlyOnceWith(kind, { search: 'Luis', page: 1, limit: 10 });
      expect(mocks.pagination?.meta).toEqual(page.meta);
      mocks.buttons.get('Luis Patient · 123')!.onClick();
      expect(mocks.selected).toHaveBeenCalledWith(person);
      expect(mocks.states[0]).toBe(false);
      expect(mocks.states[4]).toBeNull();
      if (cleanup) cleanup();
    },
  );
  it('preserves search when paging and ignores responses after closing', async () => {
    mocks.states = [true, 'Luis', { search: 'Luis', page: 1, limit: 10 }, 0, null];
    render();
    const cleanup = mocks.effects.at(-1)?.();
    await flush();
    render();
    mocks.pagination!.onChange({ page: 2, limit: 10 });
    expect(mocks.states[2]).toEqual({ search: 'Luis', page: 2, limit: 10 });
    if (cleanup) cleanup();
    let resolve!: (value: unknown) => void;
    mocks.people.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render();
    const secondCleanup = mocks.effects.at(-1)?.();
    mocks.buttons.get('Cerrar búsqueda')!.onClick();
    if (secondCleanup) secondCleanup();
    resolve(page);
    await flush();
    expect(mocks.states[4]).toBeNull();
    expect(mocks.selected).not.toHaveBeenCalled();
  });
  it('handles failures and empty results without making a selection', async () => {
    mocks.states = [true, 'Luis', { search: 'Luis', page: 1, limit: 10 }, 0, null];
    mocks.people.mockRejectedValueOnce(new Error('offline'));
    render();
    mocks.effects.at(-1)?.();
    await flush();
    expect(render()).toContain('role="alert"');
    mocks.buttons.get('Reintentar')!.onClick();
    mocks.people.mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    render();
    mocks.effects.at(-1)?.();
    await flush();
    expect(render()).toContain('No se encontraron resultados');
    expect(mocks.selected).not.toHaveBeenCalled();
  });
});
