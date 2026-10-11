import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RolesAdministration, { RoleActions } from './RolesAdministration';

import type { AdministrativeRole } from '@/types/roles';

const { permissions } = vi.hoisted(() => ({ permissions: new Set<string>() }));
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ hasPermission: (name: string) => permissions.has(name) }),
}));

beforeEach(() => permissions.clear());

describe('Role administration permission controls', () => {
  it('denies the route without its list grant and allows creation without a permission assignment grant', () => {
    expect(renderToStaticMarkup(<RolesAdministration />)).toContain('No tienes permiso para consultar roles.');
    permissions.add('role.get-all');
    expect(renderToStaticMarkup(<RolesAdministration />)).not.toContain('Crear rol');
    permissions.add('role.create');
    const html = renderToStaticMarkup(<RolesAdministration />);
    expect(html).toContain('Crear rol');
    expect(html).toContain('Cargando roles');
    expect(html).toContain('MuiCard');
  });

  it('hides actions without specific grants and protects base deactivation even when invoked directly', () => {
    const role = { idRole: 1, name: 'SUPERADMIN', isActive: true, isSystem: true } as AdministrativeRole;
    const onEdit = vi.fn();
    const onStatus = vi.fn();
    const render = (isSystem = true, isActive = true) =>
      RoleActions({
        role: { ...role, isSystem, isActive },
        hasPermission: (name) => permissions.has(name),
        onEdit,
        onStatus,
      });
    expect(renderToStaticMarkup(render())).not.toContain('<button');
    permissions.add('role.update');
    permissions.add('role.delete');
    permissions.add('role.reactivate');
    const buttons = (node: ReactNode): { disabled?: boolean; onClick?: () => void }[] =>
      Children.toArray(node).flatMap((child) => {
        if (!isValidElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>(child)) return [];
        return child.props.onClick ? [child.props] : buttons(child.props.children);
      });
    const base = buttons(render());
    expect(base[1].disabled).toBe(true);
    base[1].onClick?.();
    expect(onStatus).not.toHaveBeenCalled();
    base[0].onClick?.();
    expect(onEdit).toHaveBeenCalledOnce();
    const custom = buttons(render(false));
    expect(custom[1].disabled).toBe(false);
    custom[1].onClick?.();
    expect(onStatus).toHaveBeenCalledOnce();
    expect(renderToStaticMarkup(render(true, false))).toContain('Activar');
    expect(buttons(render(true, false))[1].disabled).toBe(false);
  });
});
