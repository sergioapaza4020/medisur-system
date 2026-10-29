import type { ComponentProps, ReactNode } from 'react';
import type * as ReactModule from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateGrant, RevokeGrant } from './ExtraordinaryGrantActions';
import type ExtraordinaryPersonPicker from './ExtraordinaryPersonPicker';
import type { ExtraordinaryGrant } from '@/types/medical-records';

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  flight: { current: false },
  grant: vi.fn(),
  revoke: vi.fn(),
  done: vi.fn(),
  buttons: new Map<string, { disabled?: boolean; onClick: () => void }>(),
  pickers: new Map<string, ComponentProps<typeof ExtraordinaryPersonPicker>>(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useRef: () => mocks.flight,
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
vi.mock('@/services/medical-records/medicalRecordsService', () => ({
  medicalRecordsService: { grant: mocks.grant, revoke: mocks.revoke },
}));
vi.mock('./ExtraordinaryPersonPicker', () => ({
  default: (props: ComponentProps<typeof ExtraordinaryPersonPicker>) => {
    mocks.pickers.set(props.kind, props);
    return <span>{props.kind}</span>;
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
    MenuItem: Container,
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
    TextField: ({ label }: { label: string }) => <input aria-label={label} />,
    Button: (props: { children: string; disabled?: boolean; onClick: () => void }) => {
      mocks.buttons.set(String(props.children), props);
      return <button disabled={props.disabled}>{props.children}</button>;
    },
    Alert: ({ children }: { children: ReactNode }) => <div role='alert'>{children}</div>,
  };
});
const patient = { idUser: 2, name: 'Luis', lastname: 'Patient', ci: '123' };
const beneficiary = { idUser: 3, name: 'Ana', lastname: 'Doctor', ci: '456' };
const grant = { idGrant: 9, patient, beneficiary } as ExtraordinaryGrant;
function render(create = true) {
  mocks.index = 0;
  mocks.buttons.clear();
  return renderToStaticMarkup(
    create ? <CreateGrant idActor={7} onCreated={mocks.done} /> : <RevokeGrant grant={grant} onRevoked={mocks.done} />,
  );
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mocks.states = [];
  mocks.flight.current = false;
  mocks.pickers.clear();
});
describe('Extraordinary concession form', () => {
  it('validates patient, beneficiary and reason before writing', () => {
    mocks.states[0] = true;
    render();
    mocks.buttons.get('Confirmar concesión')!.onClick();
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(render()).toContain('Selecciona paciente');
  });
  it('prevents a manager from granting access to themselves', () => {
    mocks.states = [true, patient, { ...beneficiary, idUser: 7 }, 'AUTHORIZATION', 1, 'Autorización documentada'];
    render();
    mocks.buttons.get('Confirmar concesión')!.onClick();
    expect(mocks.grant).not.toHaveBeenCalled();
  });
  it.each(['AUTHORIZATION', 'EMERGENCY'])(
    'submits a bounded, named %s concession once, clears input and confirms success',
    async (type) => {
      vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-29T12:00:00Z'));
      let resolve!: (value: unknown) => void;
      mocks.grant.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      mocks.states = [true, patient, beneficiary, type, 4, '  Autorización documentada  '];
      render();
      mocks.buttons.get('Confirmar concesión')!.onClick();
      mocks.buttons.get('Confirmar concesión')!.onClick();
      expect(mocks.grant).toHaveBeenCalledExactlyOnceWith({
        idPatient: 2,
        idBeneficiary: 3,
        type,
        reason: 'Autorización documentada',
        expiresAt: '2026-10-29T16:00:00.000Z',
      });
      expect(render()).toContain('Guardando autorización');
      expect(mocks.buttons.get('Guardando autorización…')!.disabled).toBe(true);
      resolve({ idGrant: 9 });
      await flush();
      expect(mocks.done).toHaveBeenCalledTimes(1);
      expect(mocks.states[0]).toBe(false);
      expect(mocks.states[5]).toBe('');
    },
  );
  it('keeps the reason on errors and allows correction or cancellation', async () => {
    mocks.grant.mockRejectedValue(new Error('offline'));
    mocks.states = [true, patient, beneficiary, 'AUTHORIZATION', 1, 'Autorización documentada'];
    render();
    mocks.buttons.get('Confirmar concesión')!.onClick();
    await flush();
    expect(render()).toContain('role="alert"');
    expect(mocks.states[5]).toBe('Autorización documentada');
    expect(mocks.done).not.toHaveBeenCalled();
    mocks.buttons.get('Cancelar')!.onClick();
    expect(mocks.states[1]).toBeNull();
    expect(mocks.states[2]).toBeNull();
    expect(mocks.states[5]).toBe('');
  });
});
describe('Extraordinary revocation confirmation', () => {
  it('requires an explicit reason and does not revoke on cancellation', () => {
    mocks.states[0] = true;
    render(false);
    mocks.buttons.get('Confirmar revocación')!.onClick();
    expect(mocks.revoke).not.toHaveBeenCalled();
    mocks.buttons.get('Volver')!.onClick();
    expect(mocks.states[0]).toBe(false);
  });
  it('prevents double revocation and refreshes the list after success', async () => {
    let resolve!: (value: unknown) => void;
    mocks.revoke.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mocks.states = [true, '  Autorización retirada  '];
    render(false);
    mocks.buttons.get('Confirmar revocación')!.onClick();
    mocks.buttons.get('Confirmar revocación')!.onClick();
    expect(mocks.revoke).toHaveBeenCalledExactlyOnceWith(9, 'Autorización retirada');
    expect(render(false)).toContain('Revocando');
    resolve({ idGrant: 9 });
    await flush();
    expect(mocks.done).toHaveBeenCalledTimes(1);
    expect(mocks.states[1]).toBe('');
  });
  it('shows failures without claiming success or losing the reason', async () => {
    mocks.revoke.mockRejectedValue(new Error('offline'));
    mocks.states = [true, 'Autorización retirada'];
    render(false);
    mocks.buttons.get('Confirmar revocación')!.onClick();
    await flush();
    expect(render(false)).toContain('role="alert"');
    expect(mocks.states[1]).toBe('Autorización retirada');
    expect(mocks.done).not.toHaveBeenCalled();
  });
});
