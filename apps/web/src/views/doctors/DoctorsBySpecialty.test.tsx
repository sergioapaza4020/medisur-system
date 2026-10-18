import type { ComponentProps } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import type * as MuiModule from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorsBySpecialty from './DoctorsBySpecialty';
import type ListPagination from '@/components/pagination/ListPagination';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  buttons: new Map<string, () => void>(),
  pagination: [] as ComponentProps<typeof ListPagination>[],
  denied: new Set<string>(),
  specialties: vi.fn(),
  doctors: vi.fn(),
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (index >= 11) return [initial, vi.fn()];
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
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (typeof props.children === 'string') mocks.buttons.set(props.children, props.onClick as () => void);
      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ hasPermission: (name: string) => !mocks.denied.has(name) }),
}));
vi.mock('@/services/doctors/doctorsService', () => ({
  doctorsService: { selectionSpecialties: mocks.specialties, bySpecialty: mocks.doctors },
}));
vi.mock('@/components/pagination/ListPagination', () => ({
  default: (props: ComponentProps<typeof ListPagination>) => {
    mocks.pagination.push(props);
    return <span>Paginación común</span>;
  },
}));

const specialtyQuery = { page: 1, limit: 10 };
const query = { page: 1, limit: 10 };
const cardiology = { idSpecialty: 1, name: 'Cardiología' };
const pediatrics = { idSpecialty: 2, name: 'Pediatría' };
const specialties = { data: [cardiology, pediatrics], meta: { page: 1, limit: 10, total: 12, totalPages: 2 } };
const doctors = {
  data: [{ idDoctor: 4, name: 'Ana', lastname: 'Pérez' }],
  meta: { page: 1, limit: 10, total: 12, totalPages: 2 },
};
function render(onSelectDoctor?: ComponentProps<typeof DoctorsBySpecialty>['onSelectDoctor']) {
  mocks.index = 0;
  mocks.effects = [];
  mocks.buttons.clear();
  mocks.pagination = [];
  return renderToStaticMarkup(<DoctorsBySpecialty onSelectDoctor={onSelectDoctor} />);
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function loadedDoctors() {
  mocks.states[5] = cardiology;
  mocks.states[8] = { query, specialty: cardiology, refresh: 0 };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.clear();
  mocks.states = [
    specialtyQuery,
    specialties,
    { query: specialtyQuery, refresh: 0 },
    0,
    null,
    null,
    query,
    doctors,
    null,
    0,
    null,
  ];
  mocks.specialties.mockResolvedValue(specialties);
  mocks.doctors.mockResolvedValue(doctors);
});

describe('Doctors by specialty', () => {
  it('denies access and requests without the consultation grant', () => {
    mocks.denied.add('doctor.get-by-specialty');
    expect(render()).toContain('No tienes permiso');
    mocks.effects.forEach((effect) => effect());
    expect(mocks.specialties).not.toHaveBeenCalled();
    expect(mocks.doctors).not.toHaveBeenCalled();
  });

  it('works with the patient consultation grant without any administrative grant and waits for selection', async () => {
    ['doctor.get-all', 'specialty.get-all', 'user.get-all'].forEach((permission) => mocks.denied.add(permission));
    expect(render()).toContain('Selecciona una especialidad.');
    mocks.effects.forEach((effect) => effect());
    await flush();
    expect(mocks.specialties).toHaveBeenCalledWith(specialtyQuery);
    expect(mocks.doctors).not.toHaveBeenCalled();
    mocks.buttons.get('Cardiología')?.();
    expect(render()).toContain('Cargando médicos');
    mocks.effects[1]();
    await flush();
    expect(mocks.doctors).toHaveBeenCalledWith(1, { page: 1, limit: 10 });
    const html = render();
    expect(html).toContain('Ana');
    expect(html).toContain('Pérez');
    expect(html).not.toContain('Correo');
    expect(html).not.toContain('Documento');
  });

  it('paginates both lists using the common component and resets doctor pages on a new specialty', async () => {
    loadedDoctors();
    render();
    mocks.pagination[1].onChange({ page: 2, limit: 5 });
    expect(render()).toContain('Cargando médicos');
    mocks.effects[1]();
    await flush();
    expect(mocks.doctors).toHaveBeenCalledWith(1, { page: 2, limit: 5 });
    render();
    mocks.buttons.get('Pediatría')?.();
    render();
    mocks.effects[1]();
    await flush();
    expect(mocks.doctors).toHaveBeenLastCalledWith(2, { page: 1, limit: 5 });
    render();
    mocks.pagination[0].onChange({ page: 2, limit: 10 });
    expect(render()).toContain('Cargando especialidades');
    mocks.effects[0]();
    await flush();
    expect(mocks.specialties).toHaveBeenCalledWith({ page: 2, limit: 10 });
    expect(mocks.states[5]).toEqual(pediatrics);
  });

  it('reports empty specialty catalogs and specialties without active doctors', async () => {
    mocks.specialties.mockResolvedValueOnce({ data: [], meta: { ...specialtyQuery, total: 0, totalPages: 0 } });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('No hay especialidades activas disponibles');
    loadedDoctors();
    mocks.doctors.mockResolvedValueOnce({ data: [], meta: { ...query, total: 0, totalPages: 0 } });
    render();
    mocks.effects[1]();
    await flush();
    expect(render()).toContain('No hay médicos activos asociados a esta especialidad');
  });

  it('handles catalog and invalid-specialty errors with independent retries', async () => {
    mocks.specialties.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Catálogo no disponible' } },
    });
    render();
    mocks.effects[0]();
    await flush();
    expect(render()).toContain('Catálogo no disponible');
    mocks.buttons.get('Reintentar especialidades')?.();
    expect(mocks.states[3]).toBe(1);
    loadedDoctors();
    mocks.doctors.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Especialidad activa no encontrada' } },
    });
    render();
    mocks.effects[1]();
    await flush();
    expect(render()).toContain('Especialidad activa no encontrada');
    mocks.buttons.get('Reintentar médicos')?.();
    expect(mocks.states[9]).toBe(1);
    expect(mocks.states[5]).toEqual(cardiology);
  });

  it('ignores obsolete requests after changing specialties and after unmount', async () => {
    loadedDoctors();
    render();
    const cleanup = mocks.effects[1]();
    if (typeof cleanup === 'function') cleanup();
    mocks.states[7] = null;
    mocks.states[8] = null;
    await flush();
    expect(mocks.states[7]).toBeNull();
    expect(mocks.states[8]).toBeNull();
    render();
    const catalogCleanup = mocks.effects[0]();
    if (typeof catalogCleanup === 'function') catalogCleanup();
    mocks.states[1] = null;
    await flush();
    expect(mocks.states[1]).toBeNull();
  });

  it('corrects pages beyond the remaining results and rechecks selection permissions', async () => {
    loadedDoctors();
    mocks.states[6] = { page: 3, limit: 10 };
    mocks.doctors.mockResolvedValueOnce({ data: [], meta: { page: 3, limit: 10, total: 1, totalPages: 1 } });
    render();
    mocks.effects[1]();
    await flush();
    expect(mocks.states[6]).toEqual({ page: 1, limit: 10 });
    render();
    mocks.denied.add('doctor.get-by-specialty');
    mocks.buttons.get('Pediatría')?.();
    expect(mocks.states[5]).toEqual(cardiology);
  });
  it('reuses the operational selector for availability and clears selection on specialty change', () => {
    loadedDoctors();
    const select = vi.fn();
    expect(render(select)).toContain('Seleccionar Ana Pérez');
    mocks.buttons.get('Seleccionar Ana Pérez')?.();
    expect(select).toHaveBeenCalledWith(doctors.data[0], cardiology);
    mocks.buttons.get('Pediatría')?.();
    expect(select).toHaveBeenLastCalledWith(null, pediatrics);
  });
});
