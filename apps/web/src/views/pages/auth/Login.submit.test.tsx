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
  default: ({ name, disabled }: { name: string; disabled: boolean }) => <input name={name} disabled={disabled} />,
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
  mocks.states = [false, ' ana ', 'secret', true, false, null];
  mocks.refs = [];
  mocks.submit = undefined;
});

describe('Login submit concurrency and navigation', () => {
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
    expect(mocks.login).toHaveBeenCalledWith({ username: 'ana', password: 'secret' }, true);
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
