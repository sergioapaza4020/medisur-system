import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from 'src/core/decorators/public/public.decorator';
import { RequestWithUser } from 'src/common/types/jwt-payload.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }

  getRequest(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const token = request.cookies?.access_token as string | undefined;

    if (token) {
      (request.headers as Record<string, string>).authorization = `Bearer ${token}`;
    }

    return request;
  }
}
