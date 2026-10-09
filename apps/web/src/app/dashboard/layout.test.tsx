import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import Layout from './layout';

const { storedCookies, replace } = vi.hoisted(() => ({ storedCookies: new Set<string>(), replace: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ has: (key: string) => storedCookies.has(key) }) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard',
}));
vi.mock('@components/Providers', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('@components/layout/vertical/Navigation', () => ({ default: () => null }));
vi.mock('@components/layout/vertical/Navbar', () => ({ default: () => null }));
vi.mock('@components/layout/vertical/Footer', () => ({ default: () => null }));
vi.mock('@layouts/LayoutWrapper', () => ({ default: () => null }));
vi.mock('@layouts/VerticalLayout', () => ({ default: () => null }));

beforeEach(() => storedCookies.clear());

describe('Protected dashboard', () => {
  it('redirects an unauthenticated route request to login', async () => {
    await expect(Layout({ children: <div>Protected content</div> })).rejects.toThrow('redirect:/login');
  });

  it('does not expose dashboard content until /auth/me confirms authentication', async () => {
    storedCookies.add('accessToken');
    const html = renderToStaticMarkup(await Layout({ children: <div>Protected content</div> }));

    expect(html).toContain('Verificando sesión');
    expect(html).not.toContain('Protected content');
  });
});
