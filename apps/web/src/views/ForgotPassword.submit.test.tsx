import type * as React from 'react';
import type { FormEvent, ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ForgotPassword from './ForgotPassword';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  states: [] as unknown[],
  index: 0,
  ref: { current: false },
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
        mocks.states[index] = value;
      },
    ];
  },
  useRef: () => mocks.ref,
}));
vi.mock('@/services/auth/authService', () => ({ authService: { requestPasswordRecovery: mocks.request } }));
vi.mock('next/link', () => ({ default: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock('@components/layout/shared/Logo', () => ({ default: () => null }));
vi.mock('@/views/pages/auth/MissionCarousel', () => ({ default: () => null }));
vi.mock('@/components/layout/shared/ModeDropdown', () => ({ default: () => null }));
vi.mock('@components/DirectionalIcon', () => ({ default: () => null }));
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
vi.mock('@mui/material/InputAdornment', () => ({ default: () => null }));
vi.mock('@mui/material/TextField', () => ({
  default: ({ name, value, disabled }: { name: string; value: string; disabled: boolean }) => (
    <input name={name} value={value} disabled={disabled} readOnly />
  ),
}));
vi.mock('@mui/material/Button', () => ({
  default: ({ children, disabled }: { children: ReactNode; disabled: boolean }) => (
    <button disabled={disabled}>{children}</button>
  ),
}));
vi.mock('@mui/material/Alert', () => ({
  default: ({ children }: { children: ReactNode }) => <div role='alert'>{children}</div>,
}));

function render() {
  mocks.index = 0;
  return renderToStaticMarkup(<ForgotPassword mode='light' />);
}
const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
const message = 'Si existe una cuenta asociada a este correo, recibirás instrucciones para restablecer tu contraseña.';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.states = ['ana@example.com', null, null, false];
  mocks.ref = { current: false };
  mocks.request.mockResolvedValue(message);
});

describe('Password recovery form', () => {
  it.each(['', 'invalid', 'a'.repeat(255) + '@example.com'])(
    'validates email before making requests',
    async (email) => {
      mocks.states[0] = email;
      render();
      await mocks.submit!(event());
      expect(mocks.request).not.toHaveBeenCalled();
      expect(render()).toContain('Ingresa un correo electrónico válido');
    },
  );

  it('shows only the generic confirmation and retains the existing MEDISUR screen', async () => {
    expect(render()).toContain('¿Olvidaste tu contraseña?');
    expect(render()).toContain('Volver a inicio de sesión');
    await mocks.submit!(event());
    expect(mocks.request).toHaveBeenCalledWith('ana@example.com');
    expect(render()).toContain(message);
    expect(render()).not.toContain('token=');
  });

  it('disables the email and submit button and synchronously blocks duplicate submissions', async () => {
    let complete!: (value: string) => void;
    mocks.request.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        }),
    );
    render();
    const submit = mocks.submit!;
    const pending = submit(event());
    await submit(event());
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(render()).toContain('disabled=""');
    expect(render()).toContain('Enviando…');
    complete(message);
    await pending;
    expect(render()).not.toContain('Enviando…');
  });

  it('uses the common API error message for throttling and permits retry', async () => {
    mocks.request.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, data: { message: 'Demasiadas solicitudes. Inténtalo más tarde.' } },
    });
    render();
    await mocks.submit!(event());
    expect(render()).toContain('Demasiadas solicitudes. Inténtalo más tarde.');
    expect(render()).not.toContain(message);
    await mocks.submit!(event());
    expect(render()).toContain(message);
  });
});
