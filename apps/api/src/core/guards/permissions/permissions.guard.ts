import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PERMISSIONS_KEY } from '@core/decorators/permissions/permissions.decorator';
import { RequestWithUser } from '@common/types/jwt-payload.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user?.permissions) throw new ForbiddenException('No permissions found');

    const hasPermission = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );
    if (!hasPermission) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
