import type * as React from 'react';
import type { FormEvent, ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Register from './Register';

import type { PatientRegistration } from '@/types/auth';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  replace: vi.fn(),
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateIndex: 0,
  refIndex: 0,
  togglePassword: undefined as (() => void) | undefined,
  submit: undefined as ((event: FormEvent<HTMLFormElement>) => Promise<void>) | undefined,
  fields: new Map<
    string,
    {
      disabled?: boolean;
      required?: boolean;
      type?: string;
      value?: string;
      error?: boolean;
      onChange: (event: { target: { value: string } }) => void;
    }
  >(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => {
    const index = mocks.stateIndex++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] =
          typeof value === 'function' ? (value as (current: unknown) => unknown)(mocks.states[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => (mocks.refs[mocks.refIndex++] ??= { current: initial }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/services/auth/authService', () => ({ authService: { register: mocks.register } }));
vi.mock('@components/layout/shared/Logo', () => ({ default: () => null }));
vi.mock('./MissionCarousel', () => ({ default: () => null }));
vi.mock('@/components/layout/shared/ModeDropdown', () => ({ default: () => null }));
vi.mock('@mui/material/Box', () => ({
  default: ({
    children,
    component,
    onSubmit,
  }: {
    children: ReactNode;
    component?: string;
    onSubmit?: typeof mocks.submit;
  }) => {
    if (component === 'form') mocks.submit = onSubmit;
    return <div>{children}</div>;
  },
}));
vi.mock('@mui/material/Button', () => ({
  default: ({ children, disabled }: { children: ReactNode; disabled: boolean }) => (
    <button disabled={disabled}>{children}</button>
  ),
}));
vi.mock('@mui/material/TextField', () => ({
  default: ({
    name,
    disabled,
    required,
    helperText,
    onChange,
    type,
    value,
    error,
    InputProps,
  }: {
    name: string;
    disabled: boolean;
    required: boolean;
    helperText?: string;
    onChange: (event: { target: { value: string } }) => void;
    type?: string;
    value?: string;
    error?: boolean;
    InputProps?: { endAdornment?: ReactNode };
  }) => {
    mocks.fields.set(name, { disabled, required, onChange, type, value, error });
    return (
      <>
        <input name={name} disabled={disabled} required={required} />
        <span>{helperText}</span>
        {InputProps?.endAdornment}
      </>
    );
  },
}));
vi.mock('@mui/material/Card', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@mui/material/CardContent', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@mui/material/Typography', () => ({
  default: ({ children, href }: { children: ReactNode; href?: string }) =>
    href ? <a href={href}>{children}</a> : <span>{children}</span>,
}));
vi.mock('@mui/material/IconButton', () => ({
  default: ({ onClick, 'aria-label': label }: { onClick: () => void; 'aria-label': string }) => {
    mocks.togglePassword = onClick;
    return <button aria-label={label} />;
  },
}));
vi.mock('@mui/material/InputAdornment', () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@mui/material/Alert', () => ({
  default: ({ children }: { children: ReactNode }) => <div role='alert'>{children}</div>,
}));

const valid = {
  name: ' Ana María ',
  lastname: ' Pérez ',
  email: ' ana@example.com ',
  ci: ' 123456 ',
  password: 'Segura123',
};
const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
function render(mode: 'light' | 'dark' = 'light') {
  mocks.stateIndex = 0;
  mocks.refIndex = 0;
  mocks.fields.clear();
  return renderToStaticMarkup(<Register mode={mode} />);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.states = [false, { ...valid }, {}, null, false, false];
  mocks.refs = [];
  mocks.submit = undefined;
  vi.stubGlobal('window', { sessionStorage: { setItem: vi.fn() } });
});

describe('Patient registration form', () => {
  it.each(['light', 'dark'] as const)(
    'shows compact password requirements and strength in %s mode without technical text',
    (mode) => {
      mocks.states[1] = { ...valid, password: 'abc' };
      let html = render(mode);
      expect(html).toContain('Pendiente');
      expect(html).toContain('Al menos 8 caracteres');
      expect(html).toContain('Fortaleza: Débil');
      expect(html).not.toMatch(/72 bits|bcrypt|bytes|UTF-8/);
      expect(mocks.fields.get('password')?.error).toBe(false);
      mocks.fields.get('password')?.onChange({ target: { value: 'Abcdefghijk1' } });
      html = render(mode);
      expect(html).toContain('Fortaleza: Fuerte');
      expect(html).not.toContain('Pendiente');
      expect(html).toContain('Cumplido');
    },
  );
  it('shows and hides the password accessibly without changing its value', () => {
    expect(render()).toContain('Mostrar contraseña');
    expect(mocks.fields.get('password')?.type).toBe('password');
    mocks.togglePassword?.();
    expect(render()).toContain('Ocultar contraseña');
    expect(mocks.fields.get('password')?.type).toBe('text');
    expect(mocks.fields.get('password')?.value).toBe(valid.password);
    mocks.togglePassword?.();
    render();
    expect(mocks.fields.get('password')?.type).toBe('password');
    expect(mocks.fields.get('password')?.value).toBe(valid.password);
  });
  it('shows only the initial mandatory account data and a login link', () => {
    const html = render();
    expect(html).toContain('Crear cuenta de paciente');
    expect(html).toContain('href="/login"');
    expect([...mocks.fields.keys()]).toEqual(['name', 'lastname', 'ci', 'email', 'password']);
    expect([...mocks.fields.values()].every((field) => field.required)).toBe(true);
    expect(html).not.toMatch(/Google|Facebook|roleNames|permissionNames/);
  });
  it('validates required fields before contacting the API and renders Spanish errors', async () => {
    mocks.states[1] = { name: '', lastname: '', email: 'invalid', ci: '', password: 'weak' };
    render();
    await mocks.submit!(event());
    expect(mocks.register).not.toHaveBeenCalled();
    const html = render();
    expect(html).toContain('correo electrónico válido');
    expect(html).toContain('una mayúscula');
    mocks.fields.get('name')?.onChange({ target: { value: 'Ana' } });
    expect((mocks.states[1] as PatientRegistration).name).toBe('Ana');
  });
  it('normalizes account fields, preserves the password and blocks double submission before rerender', async () => {
    let resolve!: () => void;
    mocks.register.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    render();
    const submit = mocks.submit!;
    const pending = submit(event());
    await submit(event());
    expect(mocks.register).toHaveBeenCalledExactlyOnceWith({
      name: 'Ana María',
      lastname: 'Pérez',
      email: 'ana@example.com',
      ci: '123456',
      password: 'Segura123',
    });
    expect(render()).toContain('Registrando');
    expect([...mocks.fields.values()].every((field) => field.disabled)).toBe(true);
    resolve();
    await pending;
    expect(render()).toContain('Ya puedes iniciar sesión');
    expect((mocks.states[1] as PatientRegistration).password).toBe('');
    expect(window.sessionStorage.setItem).toHaveBeenCalledExactlyOnceWith(
      'medisur.registration',
      JSON.stringify({ success: true, email: 'ana@example.com' }),
    );
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/login');
    expect(window.sessionStorage.setItem).toHaveBeenCalledBefore(mocks.replace);
    await mocks.submit!(event());
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });
  it('displays API messages, clears the password and unlocks after a rejected registration', async () => {
    mocks.register.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Ya existe una cuenta' } },
    });
    render();
    await mocks.submit!(event());
    expect(render()).toContain('Ya existe una cuenta');
    expect((mocks.states[1] as PatientRegistration).password).toBe('');
    expect(mocks.states[4]).toBe(false);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    mocks.fields.get('password')?.onChange({ target: { value: 'Nueva123' } });
    mocks.register.mockResolvedValueOnce(undefined);
    render();
    await mocks.submit!(event());
    expect(mocks.register).toHaveBeenCalledTimes(2);
    expect(render()).toContain('Ya puedes iniciar sesión');
  });
});
