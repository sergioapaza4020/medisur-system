import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersAdministration, { UserActions } from './UsersAdministration';

import type { AdministrativeUser } from '@/types/users';

const { permissions } = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ user: { idUser: 1 }, hasPermission: (name: string) => permissions.has(name) }),
}));

const user = { idUser: 1, isActive: true } as AdministrativeUser;
const noop = () => undefined;

beforeEach(() => permissions.clear());

describe('MEDISUR administrative permission controls', () => {
  it('denies the page without a list grant and hides creation without both required grants', () => {
    expect(renderToStaticMarkup(<UsersAdministration />)).toContain('No tienes permiso');
    permissions.add('user.get-all');
    permissions.add('user.create');
    expect(renderToStaticMarkup(<UsersAdministration />)).not.toContain('Crear usuario');
    permissions.add('user.assign-roles');
    const html = renderToStaticMarkup(<UsersAdministration />);

    expect(html).toContain('Crear usuario');
    expect(html).toContain('Buscar usuarios');
    expect(html).toContain('MuiCard');
  });

  it('shows detail, editing and state changes only with the corresponding specific permission', () => {
    const render = (isActive = true) =>
      renderToStaticMarkup(
        <UserActions
          user={{ ...user, isActive }}
          authenticatedUserId={2}
          hasPermission={(name) => permissions.has(name)}
          onDetail={noop}
          onEdit={noop}
          onStatus={noop}
        />,
      );

    expect(render()).not.toContain('<button');
    permissions.add('user.get-one-by-id');
    expect(render()).toContain('Ver');
    expect(render()).not.toContain('Editar');
    permissions.add('user.update');
    permissions.add('user.delete');
    expect(render()).toContain('Editar');
    expect(render()).toContain('Desactivar');
    expect(render(false)).not.toContain('Activar');
    permissions.add('user.reactivate');
    expect(render(false)).toContain('Activar');
    expect(render(false)).not.toContain('Desactivar');
  });

  it('disables only self-deactivation, including attempted handler calls, and keeps other actions working', () => {
    const onDetail = vi.fn();
    const onEdit = vi.fn();
    const deactivate = vi.fn();
    const renderActions = (idUser: number, isActive = true) =>
      UserActions({
        user: { ...user, idUser, isActive },
        authenticatedUserId: 1,
        hasPermission: () => true,
        onDetail,
        onEdit,
        onStatus: deactivate,
      });
    const buttons = (node: ReactNode): { children?: ReactNode; disabled?: boolean; onClick?: () => void }[] =>
      Children.toArray(node).flatMap((child) => {
        if (!isValidElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>(child)) return [];
        return child.props.onClick ? [child.props] : buttons(child.props.children);
      });

    const self = buttons(renderActions(1));
    expect(self.map((button) => button.children)).toEqual(['Ver', 'Editar', 'Desactivar']);
    expect(self[2].disabled).toBe(true);
    self.forEach((button) => button.onClick?.());
    expect(deactivate).not.toHaveBeenCalled();
    expect(onDetail).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(renderToStaticMarkup(renderActions(1))).toContain('disabled=""');

    const other = buttons(renderActions(2))[2];
    expect(other.disabled).toBe(false);
    other.onClick?.();
    expect(deactivate).toHaveBeenCalledOnce();
    const restore = buttons(renderActions(1, false))[2];
    expect(restore.children).toBe('Activar');
    expect(restore.disabled).toBe(false);
    restore.onClick?.();
    expect(deactivate).toHaveBeenCalledTimes(2);
  });
});
