import type * as React from 'react';
import type { FormEvent, ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './Login';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateIndex: 0,
  refIndex: 0,
  effects: [] as (() => void)[],
  submit: undefined as ((event: FormEvent<HTMLFormElement>) => Promise<void>) | undefined,
}));

// Reuse the repository's server-rendered component strategy, retaining hook state between renders.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => {
    const index = mocks.stateIndex++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = mocks.refIndex++;
    return (mocks.refs[index] ??= { current: initial });
  },
  useEffect: (effect: () => void) => {
    mocks.effects.push(effect);
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('next/link', () => ({ default: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock('@/services/auth/authService', () => ({ authService: { login: mocks.login } }));
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
  default: ({ name, disabled, value }: { name: string; disabled: boolean; value: string }) => (
    <input name={name} disabled={disabled} value={value} readOnly />
  ),
}));
vi.mock('@mui/material/Card', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@mui/material/CardContent', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@mui/material/Typography', () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@mui/material/IconButton', () => ({ default: () => null }));
vi.mock('@mui/material/InputAdornment', () => ({ default: () => null }));
vi.mock('@mui/material/Checkbox', () => ({ default: () => null }));
vi.mock('@mui/material/FormControlLabel', () => ({ default: () => null }));
vi.mock('@mui/material/Alert', () => ({
  default: ({ children }: { children: ReactNode }) => <div role='alert'>{children}</div>,
}));

function render() {
  mocks.stateIndex = 0;
  mocks.refIndex = 0;
  return renderToStaticMarkup(<Login mode='light' />);
}

const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.states = [false, ' ANA@example.com ', 'secret', true, false, null];
  mocks.refs = [];
  mocks.submit = undefined;
  mocks.effects = [];
  vi.stubGlobal('window', { sessionStorage: { getItem: vi.fn().mockReturnValue(null), removeItem: vi.fn() } });
});

describe('Registration feedback on login', () => {
  it('prefills only the email, displays success and consumes the notice even if the effect runs twice', async () => {
    mocks.states = [];
    vi.mocked(window.sessionStorage.getItem).mockReturnValueOnce(
      JSON.stringify({
        success: true,
        email: 'ana@example.com',
        password: 'must-not-transfer',
        accessToken: 'ignored',
      }),
    );
    render();
    mocks.effects[0]();
    mocks.effects[0]();
    await Promise.resolve();
    const html = render();
    expect(html).toContain('Cuenta creada correctamente. Inicia sesión para continuar.');
    expect(html).toContain('name="email" value="ana@example.com"');
    expect(html).toContain('name="password" value=""');
    expect(html).not.toContain('must-not-transfer');
    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('medisur.registration');
    expect(mocks.login).not.toHaveBeenCalled();
    mocks.states = [];
    mocks.refs = [];
    mocks.effects = [];
    render();
    mocks.effects[0]();
    await Promise.resolve();
    expect(render()).not.toContain('Cuenta creada correctamente');
  });

  it('keeps direct login empty and does not show a registration message', async () => {
    mocks.states = [];
    render();
    mocks.effects[0]();
    await Promise.resolve();
    const html = render();
    expect(html).not.toContain('Cuenta creada correctamente');
    expect(html).toContain('name="email" value=""');
    expect(html).toContain('name="password" value=""');
    expect(mocks.login).not.toHaveBeenCalled();
  });
});

describe('Login submit concurrency and navigation', () => {
  it('validates email format before contacting the API', async () => {
    mocks.states[1] = 'invalid';
    render();
    await mocks.submit!(event());
    expect(mocks.login).not.toHaveBeenCalled();
    expect(render()).toContain('Ingresa un correo electrónico válido');
  });
  it('disables the button while pending and ignores repeated click/Enter submits even before rerender', async () => {
    let resolve!: () => void;
    mocks.login.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    render();
    const submit = mocks.submit!;
    const pending = submit(event());
    await submit(event());
    await submit(event());
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'secret' }, true);
    expect(render()).toContain('<button disabled="">Ingresando…</button>');
    await mocks.submit!(event());
    expect(mocks.replace).not.toHaveBeenCalled();
    resolve();
    await pending;
  });

  it('keeps the button and handler locked after success while login remains mounted', async () => {
    mocks.login.mockResolvedValue({});
    render();
    const originalSubmit = mocks.submit!;
    await originalSubmit(event());
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/dashboard');
    expect(render()).toContain('<button disabled="">Ingresando…</button>');
    expect(mocks.states[2]).toBe('');
    await mocks.submit!(event());
    await originalSubmit(event());
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it('shows the existing error, unlocks after failure and allows a new attempt', async () => {
    mocks.login.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Credenciales inválidas' } },
    });
    render();
    await mocks.submit!(event());
    const html = render();
    expect(html).toContain('<button>Iniciar sesión</button>');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Credenciales inválidas');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.states[2]).toBe('');
    mocks.states[2] = 'corrected-secret';
    mocks.login.mockResolvedValueOnce({});
    render();
    await mocks.submit!(event());
    expect(mocks.login).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/dashboard');
    expect(render()).toContain('<button disabled="">Ingresando…</button>');
  });
});
