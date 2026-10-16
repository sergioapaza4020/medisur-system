import type * as React from 'react';
import type { FormEvent, ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPassword from './ResetPassword';

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  reset: vi.fn(),
  replace: vi.fn(),
  states: [] as unknown[],
  index: 0,
  ref: { current: false },
  effects: [] as (() => void)[],
  submit: undefined as ((event: FormEvent<HTMLFormElement>) => Promise<void>) | undefined,
}));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
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
  useRef: () => mocks.ref,
  useEffect: (effect: () => void) => {
    mocks.effects.push(effect);
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/services/auth/authService', () => ({
  authService: { validateRecoveryToken: mocks.validate, resetPassword: mocks.reset },
}));
vi.mock('@components/layout/shared/Logo', () => ({ default: () => null }));
vi.mock('@mui/material/Box', () => ({
  default: ({ children, onSubmit }: { children: ReactNode; onSubmit?: typeof mocks.submit }) => {
    if (onSubmit) mocks.submit = onSubmit;
    return <div>{children}</div>;
  },
}));
vi.mock('@mui/material/Card', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@mui/material/CardContent', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@mui/material/Typography', () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@mui/material/Alert', () => ({
  default: ({ children }: { children: ReactNode }) => <div role='alert'>{children}</div>,
}));
vi.mock('@mui/material/CircularProgress', () => ({ default: () => <span>Cargando</span> }));
vi.mock('@mui/material/TextField', () => ({
  default: ({
    name,
    disabled,
    value,
    autoComplete,
  }: {
    name: string;
    disabled: boolean;
    value: string;
    autoComplete: string;
  }) => <input name={name} disabled={disabled} value={value} autoComplete={autoComplete} readOnly />,
}));
vi.mock('@mui/material/Button', () => ({
  default: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => (
    <button disabled={disabled}>{children}</button>
  ),
}));

const token = 'a'.repeat(64);
const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
function render(value = token) {
  mocks.index = 0;
  mocks.submit = undefined;
  return renderToStaticMarkup(<ResetPassword token={value} />);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = [];
  mocks.ref = { current: false };
  mocks.effects = [];
  mocks.validate.mockResolvedValue(undefined);
  mocks.reset.mockResolvedValue(undefined);
});

describe('Reset password form', () => {
  it('shows loading and no password fields until the backend validates the token', async () => {
    expect(render()).toContain('Verificando enlace');
    expect(render()).not.toContain('name="password"');
    mocks.effects.pop()!();
    await vi.waitFor(() => expect(mocks.states[0]).toBe('valid'));
    expect(mocks.validate).toHaveBeenCalledWith(token);
    expect(render()).toContain('name="password"');
    expect(render()).toContain('autoComplete="new-password"');
  });

  it.each(['', 'invalid', 'a'.repeat(63)])(
    'blocks malformed or missing tokens without calling the backend',
    (value) => {
      render(value);
      mocks.effects.pop()!();
      const html = render(value);
      expect(html).toContain('El enlace de recuperación no es válido o ha expirado');
      expect(html).not.toContain('name="password"');
      expect(mocks.validate).not.toHaveBeenCalled();
      expect(mocks.reset).not.toHaveBeenCalled();
    },
  );

  it('hides the form for expired, used or invalid links returned by the API', async () => {
    mocks.validate.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'El enlace de recuperación no es válido o ha expirado.' } },
    });
    render();
    mocks.effects.pop()!();
    await vi.waitFor(() => expect(mocks.states[0]).toBe('error'));
    expect(render()).toContain('Solicitar otro enlace');
    expect(render()).not.toContain('name="password"');
  });

  it.each(['short', 'minuscula1', 'MAYUSCULA1', 'SinNumeros', 'Aa1' + 'á'.repeat(35)])(
    'reuses the existing password policy: %s',
    async (password) => {
      mocks.states = ['valid', password, password, null, false, 0];
      render();
      await mocks.submit!(event());
      expect(mocks.reset).not.toHaveBeenCalled();
      expect(render()).toContain('Usa al menos 8 caracteres');
    },
  );

  it('requires matching confirmation without making a request', async () => {
    mocks.states = ['valid', 'NuevaClave123', 'OtraClave123', null, false, 0];
    render();
    await mocks.submit!(event());
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(render()).toContain('Las contraseñas deben coincidir');
  });

  it('blocks concurrent submits, clears passwords and redirects to login after success', async () => {
    let complete!: () => void;
    mocks.reset.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    mocks.states = ['valid', 'NuevaClave123', 'NuevaClave123', null, false, 0];
    render();
    const submit = mocks.submit!;
    const pending = submit(event());
    await submit(event());
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(mocks.reset).toHaveBeenCalledWith(token, 'NuevaClave123', 'NuevaClave123');
    expect(render()).toContain('Guardando…');
    expect(render()).toContain('disabled=""');
    complete();
    await pending;
    expect(mocks.states[1]).toBe('');
    expect(mocks.states[2]).toBe('');
    expect(mocks.replace).toHaveBeenCalledWith('/login');
    await submit(event());
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(render()).toContain('Contraseña restablecida');
  });

  it('clears passwords and hides the form for revalidation after a failed save', async () => {
    mocks.reset.mockRejectedValue({ isAxiosError: true, response: { data: { message: 'No se pudo guardar' } } });
    mocks.states = ['valid', 'NuevaClave123', 'NuevaClave123', null, false, 0];
    render();
    await mocks.submit!(event());
    expect(mocks.states[1]).toBe('');
    expect(mocks.states[2]).toBe('');
    expect(render()).toContain('No se pudo guardar');
    expect(render()).not.toContain('name="password"');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
