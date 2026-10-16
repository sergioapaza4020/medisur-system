import type * as React from 'react';
import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserDropdown from './UserDropdown';

const mocks = vi.hoisted(() => ({
  user: { name: 'Ana', lastname: 'Perez', email: 'ana@example.test', avatarUrl: null as string | null },
  logout: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  refIndex: 0,
  items: new Map<string, { onClick: () => Promise<void> | void; disabled?: boolean }>(),
  keyDown: undefined as ((event: { key: string; preventDefault: () => void }) => void) | undefined,
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
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ useAuth: () => ({ user: mocks.user, logout: mocks.logout }) }));
vi.mock('@mui/material/Popper', () => ({
  default: ({ children }: { children: (value: { TransitionProps: object }) => ReactNode }) =>
    children({ TransitionProps: {} }),
}));
vi.mock('@mui/material/Fade', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('@mui/material/ClickAwayListener', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('@mui/material/Typography', () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@mui/material/MenuItem', () => ({
  default: ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) => {
    const text = renderToStaticMarkup(<>{children}</>).replace(/<[^>]*>/g, '');
    mocks.items.set(text, { onClick, disabled });
    return <button disabled={disabled}>{children}</button>;
  },
}));
vi.mock('@mui/material/MenuList', () => ({
  default: ({ children, onKeyDown }: { children: ReactNode; onKeyDown: typeof mocks.keyDown }) => {
    mocks.keyDown = onKeyDown;
    return <div>{children}</div>;
  },
}));

function render() {
  mocks.index = 0;
  mocks.refIndex = 0;
  mocks.items.clear();
  return renderToStaticMarkup(<UserDropdown />);
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.states = [];
  mocks.refs = [];
  mocks.user.avatarUrl = null;
});

describe('authenticated user menu', () => {
  it('places account settings before logout without administrative permissions and closes when navigating', async () => {
    const html = render();
    expect(html.indexOf('Configuración de cuenta')).toBeLessThan(html.indexOf('Cerrar sesión'));
    mocks.states[0] = true;
    render();
    await mocks.items.get('Configuración de cuenta')!.onClick();
    expect(mocks.push).toHaveBeenCalledWith('/dashboard/account-settings');
    expect(mocks.states[0]).toBe(false);
  });
  it('keeps logout and redirection working even when the API fails', async () => {
    mocks.logout.mockRejectedValueOnce(new Error('offline'));
    render();
    await mocks.items.get('Cerrar sesión')!.onClick();
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith('/login');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it('closes on Escape and restores focus', () => {
    render();
    mocks.states[0] = true;
    const focus = vi.fn();
    mocks.refs[0].current = { focus };
    render();
    mocks.keyDown!({ key: 'Escape', preventDefault: vi.fn() });
    expect(mocks.states[0]).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
  });
  it('shows initials without a photo and reflects global avatar changes in both menu avatars', () => {
    expect(render()).not.toContain('<img');
    mocks.user.avatarUrl = 'https://storage.example.test/photo.png';
    expect(render().match(/src="https:\/\/storage.example.test\/photo.png"/g)).toHaveLength(2);
    mocks.user.avatarUrl = null;
    expect(render()).not.toContain('<img');
  });
});
