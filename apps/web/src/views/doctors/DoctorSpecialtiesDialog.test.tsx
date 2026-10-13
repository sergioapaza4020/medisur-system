import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorSpecialtiesDialog from './DoctorSpecialtiesDialog';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  buttons: new Map<string, { disabled?: boolean; click?: () => void }>(),
  checkboxes: [] as ComponentProps<typeof MuiModule.Checkbox>[],
  pagination: null as ComponentProps<typeof ListPagination> | null,
  denied: new Set<string>(),
  get: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  saved: vi.fn(),
  close: vi.fn(),
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 10) return [initial, vi.fn()];
      if (!(index in mocks.states)) mocks.states[index] = initial;
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
vi.mock('@mui/material', async (original) => {
  const actual = await original<typeof MuiModule>();
  return {
    ...actual,
    Dialog: ({ children }: ComponentProps<typeof actual.Dialog>) => <>{children}</>,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      const label = props['aria-label'] ?? (typeof props.children === 'string' ? props.children : '');
      mocks.buttons.set(label, { disabled: props.disabled, click: props.onClick as () => void });
      return <actual.Button {...props} />;
    },
    Checkbox: (props: ComponentProps<typeof actual.Checkbox>) => {
      mocks.checkboxes.push(props);
      return <actual.Checkbox {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ hasPermission: (name: string) => !mocks.denied.has(name) }),
}));
vi.mock('@/services/doctors/doctorsService', () => ({
  doctorsService: { getSpecialties: mocks.get, assignSpecialties: mocks.save },
}));
vi.mock('@/services/specialties/specialtiesService', () => ({ specialtiesService: { listPage: mocks.list } }));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination = props;
    return <span>Paginación común</span>;
  },
}));

const inactive = { idSpecialty: 1, name: 'Cardiología', isActive: false };
const active = { idSpecialty: 2, name: 'Medicina interna', isActive: true };
const doctor = {
  idDoctor: 1,
  isActive: true,
  user: { idUser: 4, name: 'Ana', lastname: 'Pérez', email: 'a@example.com', ci: '123', isActive: true },
  specialties: [inactive],
};
const query = { page: 1, limit: 10, status: 'active' };
const page = { data: [active], meta: { page: 1, limit: 10, total: 11, totalPages: 2 } };
function render() {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  mocks.checkboxes = [];
  mocks.pagination = null;
  return renderToStaticMarkup(<DoctorSpecialtiesDialog idDoctor={1} onSaved={mocks.saved} onClose={mocks.close} />);
}
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
function toggleFirst() {
  mocks.checkboxes[0].onChange?.({} as ReactModule.ChangeEvent<HTMLInputElement>, true);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.states = [doctor, [inactive], query, page, query, 0, null, null, null, false];
  mocks.get.mockResolvedValue(doctor);
  mocks.list.mockResolvedValue(page);
  mocks.save.mockResolvedValue(doctor);
});

describe('Doctor specialty assignment editor', () => {
  it.each(['doctor.assign-specialties', 'specialty.get-all'])(
    'hides editing and prevents requests without %s',
    (permission) => {
      mocks.denied.add(permission);
      expect(render()).toContain('No tienes permiso');
      mocks.effects.forEach((effect) => effect());
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.buttons.has('Guardar especialidades')).toBe(false);
    },
  );

  it('loads fresh assignments including inactive ones and ignores responses after unmount', async () => {
    mocks.states[0] = null;
    expect(render()).toContain('Cargando asignaciones');
    mocks.effects.forEach((effect) => effect());
    await flush();
    expect(mocks.get).toHaveBeenCalledWith(1);
    expect(render()).toContain('Cardiología (inactiva)');
    const cleanup = mocks.effects[0]();
    if (typeof cleanup === 'function') cleanup();
    await flush();
    expect(mocks.states[0]).toEqual(doctor);
  });

  it('keeps selections across catalog pages, removes an inactive assignment and saves once with feedback', async () => {
    render();
    toggleFirst();
    render();
    mocks.pagination?.onChange({ page: 2, limit: 10 });
    mocks.list.mockResolvedValueOnce({
      ...page,
      data: [{ idSpecialty: 3, name: 'Pediatría', isActive: true }],
      meta: { ...page.meta, page: 2 },
    });
    expect(render()).toContain('Cargando especialidades');
    mocks.effects[1]();
    await flush();
    render();
    toggleFirst();
    render();
    mocks.buttons.get('Retirar Cardiología')?.click?.();
    render();
    const save = mocks.buttons.get('Guardar especialidades')?.click;
    save?.();
    save?.();
    await flush();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith(1, [2, 3]);
    expect(mocks.saved).toHaveBeenCalledTimes(1);
  });

  it('allows removals and an empty selection for inactive profiles but prevents adding', async () => {
    mocks.states[0] = { ...doctor, isActive: false };
    render();
    expect(mocks.checkboxes[0].disabled).toBe(true);
    toggleFirst();
    expect(mocks.states[1]).toEqual([inactive]);
    mocks.buttons.get('Retirar Cardiología')?.click?.();
    render();
    mocks.buttons.get('Guardar especialidades')?.click?.();
    await flush();
    expect(mocks.save).toHaveBeenCalledWith(1, []);
  });

  it('preserves edits after a failed save, rechecks permissions and validates duplicate selection', async () => {
    mocks.save.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Especialidad activa no encontrada' } },
    });
    render();
    toggleFirst();
    render();
    mocks.buttons.get('Guardar especialidades')?.click?.();
    await flush();
    expect(render()).toContain('Especialidad activa no encontrada');
    expect(mocks.states[1]).toEqual([inactive, active]);
    expect(mocks.saved).not.toHaveBeenCalled();
    mocks.denied.add('doctor.assign-specialties');
    mocks.buttons.get('Guardar especialidades')?.click?.();
    await flush();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    mocks.denied.clear();
    mocks.states[1] = [active, active];
    render();
    mocks.buttons.get('Guardar especialidades')?.click?.();
    await flush();
    expect(render()).toContain('sin duplicados');
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it('handles failed loads with retry and an empty active catalog', async () => {
    mocks.get.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('Reintentar asignaciones');
    expect(mocks.buttons.get('Guardar especialidades')?.disabled).toBe(true);
    mocks.buttons.get('Reintentar asignaciones')?.click?.();
    render();
    mocks.effects[0]();
    await flush();
    mocks.list.mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    render();
    mocks.effects[1]();
    await flush();
    expect(render()).toContain('No hay especialidades activas disponibles');
  });

  it('retries catalog loading without discarding the edited selection', async () => {
    render();
    toggleFirst();
    mocks.list.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Catálogo no disponible' } } });
    render();
    mocks.effects[1]();
    await flush();
    expect(render()).toContain('Reintentar catálogo');
    mocks.buttons.get('Reintentar catálogo')?.click?.();
    render();
    mocks.effects[1]();
    await flush();
    expect(mocks.states[1]).toEqual([inactive, active]);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
