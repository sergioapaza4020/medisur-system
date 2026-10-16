import type * as React from 'react';
import type { FormEvent, ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AccountDetails from './AccountDetails';
import AccountSecurity from './AccountSecurity';
import AccountDelete from './AccountDelete';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  password: vi.fn(),
  deactivate: vi.fn(),
  replace: vi.fn(),
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  refIndex: 0,
  effects: [] as (() => void)[],
  submit: undefined as ((event: FormEvent<HTMLFormElement>) => Promise<void>) | undefined,
  fields: new Map<
    string,
    { value: string; disabled?: boolean; onChange: (event: { target: { value: string } }) => void }
  >(),
  buttons: new Map<string, { disabled?: boolean; onClick?: () => void | Promise<void> }>(),
}));

vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = mocks.index++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = typeof value === 'function' ? value(mocks.states[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => (mocks.refs[mocks.refIndex++] ??= { current: initial }),
  useEffect: (effect: () => void) => {
    mocks.effects.push(effect);
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ useAuth: () => ({ updateProfile: vi.fn() }) }));
vi.mock('./AccountPhoto', () => ({ default: () => <span>Iniciales de tu cuenta</span> }));
vi.mock('@/services/users/myAccountService', () => ({
  myAccountService: {
    get: mocks.get,
    update: mocks.update,
    changePassword: mocks.password,
    deactivate: mocks.deactivate,
  },
}));
vi.mock('@mui/material/Box', () => ({
  default: ({ children, onSubmit }: { children: ReactNode; onSubmit?: typeof mocks.submit }) => {
    if (onSubmit) mocks.submit = onSubmit;
    return <div>{children}</div>;
  },
}));
vi.mock('@mui/material/Button', () => ({
  default: ({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick?: () => void }) => {
    mocks.buttons.set(children, { disabled, onClick });
    return <button disabled={disabled}>{children}</button>;
  },
}));
vi.mock('@mui/material/TextField', () => ({
  default: ({
    name,
    value,
    disabled,
    onChange,
    helperText,
  }: {
    name: string;
    value: string;
    disabled?: boolean;
    helperText?: string;
    onChange: (event: { target: { value: string } }) => void;
  }) => {
    mocks.fields.set(name, { value, disabled, onChange });
    return (
      <>
        <input name={name} value={value} disabled={disabled} readOnly />
        <span>{helperText}</span>
      </>
    );
  },
}));
vi.mock('@mui/material/Dialog', () => ({
  default: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role='dialog'>{children}</div> : null,
}));

const profile = { name: 'Ana', lastname: 'Perez', email: 'ana@example.com', ci: '123456' };
const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
function render(Component = AccountDetails) {
  mocks.index = 0;
  mocks.refIndex = 0;
  mocks.fields.clear();
  mocks.buttons.clear();
  mocks.effects = [];
  return renderToStaticMarkup(<Component />);
}
function change(field: string, value: string) {
  mocks.fields.get(field)!.onChange({ target: { value } });
}
async function load() {
  render();
  mocks.effects[0]();
  await Promise.resolve();
  return render();
}
function passwordForm(password = 'NuevaSegura123', confirmation = password) {
  render(AccountSecurity);
  change('currentPassword', 'Anterior123');
  change('password', password);
  change('confirmPassword', confirmation);
  render(AccountSecurity);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.states = [];
  mocks.refs = [];
  mocks.submit = undefined;
  mocks.get.mockResolvedValue(profile);
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
});

describe('account profile', () => {
  it('shows loading then real data and initials without template images', async () => {
    expect(render()).toContain('Cargando cuenta');
    const html = await load();
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.fields.get('name')?.value).toBe('Ana');
    expect(html).toContain('Iniciales de tu cuenta');
    expect(html).not.toContain('/images/avatars');
    expect(mocks.buttons.get('Guardar cambios')?.disabled).toBe(true);
  });

  it('offers retry on loading failure', async () => {
    mocks.get.mockRejectedValueOnce(new Error('No disponible'));
    expect(await load()).toContain('Reintentar');
    expect(mocks.fields.size).toBe(0);
  });

  it('validates personal fields before making requests', async () => {
    await load();
    change('email', 'invalid');
    render();
    await mocks.submit!(event());
    expect(render()).toContain('Ingresa un correo');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('avoids unchanged requests, sends only changes, blocks duplicate submits and shows success', async () => {
    await load();
    await mocks.submit!(event());
    expect(mocks.update).not.toHaveBeenCalled();
    let complete!: (value: typeof profile) => void;
    mocks.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    change('name', 'Maria');
    render();
    const pending = mocks.submit!(event());
    expect(render()).toContain('Guardando');
    expect(mocks.fields.get('name')?.disabled).toBe(true);
    await mocks.submit!(event());
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith({ name: 'Maria' });
    complete({ ...profile, name: 'Maria' });
    await pending;
    expect(render()).toContain('Datos actualizados correctamente');
    expect(mocks.buttons.get('Guardar cambios')?.disabled).toBe(true);
  });

  it('keeps edits on API failure and can reset to persisted data', async () => {
    await load();
    mocks.update.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'email already exists' } } });
    change('email', 'otro@example.com');
    render();
    await mocks.submit!(event());
    expect(render()).toContain('email already exists');
    expect(mocks.fields.get('email')?.value).toBe('otro@example.com');
    await mocks.buttons.get('Restablecer')?.onClick?.();
    render();
    expect(mocks.fields.get('email')?.value).toBe(profile.email);
  });
});

describe('account password', () => {
  it.each([
    ['weak', 'weak', 'Usa al menos 8'],
    ['NuevaSegura123', 'Diferente123', 'Las contraseñas deben coincidir'],
    ['Anterior123', 'Anterior123', 'debe ser diferente'],
  ])('validates policy, confirmation and reuse: %s', async (password, confirmation, message) => {
    passwordForm(password, confirmation);
    await mocks.submit!(event());
    expect(render(AccountSecurity)).toContain(message);
    expect(mocks.password).not.toHaveBeenCalled();
  });

  it('requires the current password', async () => {
    passwordForm();
    change('currentPassword', '');
    render(AccountSecurity);
    await mocks.submit!(event());
    expect(render(AccountSecurity)).toContain('Ingresa tu contraseña actual');
    expect(mocks.password).not.toHaveBeenCalled();
  });

  it('blocks duplicates, reports success and redirects to login', async () => {
    let complete!: () => void;
    mocks.password.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    passwordForm();
    const pending = mocks.submit!(event());
    expect(render(AccountSecurity)).toContain('Guardando');
    await mocks.submit!(event());
    expect(mocks.password).toHaveBeenCalledOnce();
    expect(mocks.password).toHaveBeenCalledWith('Anterior123', 'NuevaSegura123');
    complete();
    await pending;
    expect(render(AccountSecurity)).toContain('Contraseña actualizada');
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });

  it('shows backend errors, clears password inputs and enables retry', async () => {
    mocks.password.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Contraseña actual incorrecta' } },
    });
    passwordForm();
    await mocks.submit!(event());
    expect(render(AccountSecurity)).toContain('Contraseña actual incorrecta');
    expect(mocks.fields.get('currentPassword')?.value).toBe('');
    expect(mocks.buttons.get('Cambiar contraseña')?.disabled).toBe(false);
  });
});

describe('account deactivation', () => {
  it('requires confirmation and cancel does not deactivate', async () => {
    expect(render(AccountDelete)).not.toContain('role="dialog"');
    await mocks.buttons.get('Desactivar cuenta')?.onClick?.();
    expect(render(AccountDelete)).toContain('role="dialog"');
    await mocks.buttons.get('Cancelar')?.onClick?.();
    expect(render(AccountDelete)).not.toContain('role="dialog"');
    expect(mocks.deactivate).not.toHaveBeenCalled();
  });

  it('confirms once, disables cancellation during the request and redirects after success', async () => {
    let complete!: () => void;
    mocks.deactivate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    render(AccountDelete);
    await mocks.buttons.get('Desactivar cuenta')?.onClick?.();
    render(AccountDelete);
    const pending = mocks.buttons.get('Confirmar desactivación')?.onClick?.();
    expect(render(AccountDelete)).toContain('Desactivando');
    expect(mocks.buttons.get('Cancelar')?.disabled).toBe(true);
    await mocks.buttons.get('Desactivando…')?.onClick?.();
    expect(mocks.deactivate).toHaveBeenCalledOnce();
    complete();
    await pending;
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });

  it('shows the backend restriction in the dialog without logging out', async () => {
    mocks.deactivate.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Último SUPERADMIN activo' } },
    });
    render(AccountDelete);
    await mocks.buttons.get('Desactivar cuenta')?.onClick?.();
    render(AccountDelete);
    await mocks.buttons.get('Confirmar desactivación')?.onClick?.();
    expect(render(AccountDelete)).toContain('Último SUPERADMIN activo');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.buttons.get('Cancelar')?.disabled).toBe(false);
  });
});
