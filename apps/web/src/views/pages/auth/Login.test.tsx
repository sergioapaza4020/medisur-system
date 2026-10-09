import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Login from './Login';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@components/layout/shared/Logo', () => ({ default: () => null }));
vi.mock('./MissionCarousel', () => ({ default: () => null }));
vi.mock('@/components/layout/shared/ModeDropdown', () => ({ default: () => null }));

describe('MEDISUR login', () => {
  it('uses username/password fields and Materio/MUI without external identity actions', () => {
    const html = renderToStaticMarkup(<Login mode='light' />);

    expect(html).toContain('name="username"');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('MuiCard');
    expect(html).not.toContain('Google');
    expect(html).not.toContain('Facebook');
    expect(html).not.toContain('Materio');
  });
});
