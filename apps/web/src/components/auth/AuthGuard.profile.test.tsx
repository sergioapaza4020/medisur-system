import type * as React from 'react';
import type { ReactElement } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import AuthGuard from './AuthGuard';
import type { AuthUser } from '@/types/auth';
import { AUTH_CLEARED_EVENT } from '@/utils/http/authCookies';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  replace: vi.fn(),
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  refIndex: 0,
  effect: undefined as (() => void) | undefined,
  listeners: new Map<string, () => void>(),
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
    mocks.effect = effect;
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => '/dashboard/account-settings',
}));
vi.mock('@/services/auth/authService', () => ({ authService: { getCurrentUser: mocks.get, logout: vi.fn() } }));

const user: AuthUser = {
  idUser: 1,
  idSession: 2,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.test',
  roles: ['PATIENT'],
  permissions: [],
  avatarUrl: null,
};
type ContextValue = {
  user: AuthUser;
  updateProfile: (profile: Partial<Pick<AuthUser, 'name' | 'email' | 'lastname' | 'avatarUrl'>>) => void;
};
function render() {
  mocks.index = 0;
  mocks.refIndex = 0;
  return (AuthGuard({ children: null }) as ReactElement<{ value: ContextValue }>).props.value;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.states = [];
  mocks.refs = [];
  mocks.listeners.clear();
  vi.stubGlobal('window', {
    addEventListener: (name: string, callback: () => void) => mocks.listeners.set(name, callback),
    removeEventListener: vi.fn(),
  });
  mocks.get.mockResolvedValue(user);
});
async function load() {
  render();
  mocks.effect!();
  await Promise.resolve();
  return render();
}

describe('global account presentation updates', () => {
  it('updates the avatar immediately while preserving identity and authorization', async () => {
    const context = await load();
    context.updateProfile({ avatarUrl: 'https://storage.example.test/new.png' });
    expect(render().user).toEqual({ ...user, avatarUrl: 'https://storage.example.test/new.png' });
    render().updateProfile({ name: 'Ana Maria', email: user.email });
    expect(render().user.avatarUrl).toContain('new.png');
    render().updateProfile({ name: 'Ana Maria', email: user.email, avatarUrl: null });
    expect(render().user.avatarUrl).toBeNull();
  });
  it('does not let an older focus request overwrite a freshly uploaded avatar', async () => {
    const context = await load();
    let complete!: (value: AuthUser) => void;
    mocks.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    mocks.listeners.get('focus')!();
    context.updateProfile({ name: user.name, email: user.email, avatarUrl: 'https://storage.example.test/new.png' });
    complete(user);
    await Promise.resolve();
    expect(render().user.avatarUrl).toContain('new.png');
  });
  it('cannot restore authentication through a late profile update after logout', async () => {
    const context = await load();
    mocks.listeners.get(AUTH_CLEARED_EVENT)!();
    context.updateProfile({ name: user.name, email: user.email, avatarUrl: 'https://storage.example.test/new.png' });
    expect(mocks.states[0]).toEqual({ user: null, error: null });
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });
});
