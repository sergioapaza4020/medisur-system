import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { PermissionsGuard } from './permissions.guard';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';

@Permissions('role.get-all')
class ProtectedController {
  list(this: void) {}
  @Permissions('role.update', 'role.assign-permissions')
  update(this: void) {}
}

function context(user: unknown, handler = ProtectedController.prototype.list) {
  return new ExecutionContextHost([{ user }], ProtectedController, handler);
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows an explicit permission regardless of the role name', () => {
    expect(guard.canActivate(context({ roles: ['PATIENT'], permissions: ['role.get-all'] }))).toBe(
      true,
    );
  });

  it('rejects missing permissions, including SUPERADMIN without a grant', () => {
    for (const user of [undefined, { roles: ['SUPERADMIN'], permissions: [] }]) {
      expect(() => guard.canActivate(context(user))).toThrow(ForbiddenException);
    }
  });

  it('requires every permission on an operation that assigns capabilities', () => {
    const handler = ProtectedController.prototype.update;
    expect(() => guard.canActivate(context({ permissions: ['role.update'] }, handler))).toThrow(
      ForbiddenException,
    );
    expect(
      guard.canActivate(
        context({ permissions: ['role.update', 'role.assign-permissions'] }, handler),
      ),
    ).toBe(true);
  });

  it('leaves routes without permission metadata to authentication', () => {
    const unprotected = new ExecutionContextHost([{}], class {}, () => undefined);
    expect(guard.canActivate(unprotected)).toBe(true);
  });
});
