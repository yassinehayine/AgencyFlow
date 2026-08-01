import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { AccessScope } from './access-scope';
import { IS_PUBLIC_KEY } from './authorization.decorators';

interface RequestWithScope extends Request {
  accessScope?: AccessScope;
}

/**
 * Layer 1 of the authorisation pipeline: is the token valid?
 *
 * Registered globally, so every route is protected unless it explicitly
 * carries @Public(). Opt-out is safer than opt-in - forgetting a guard would
 * silently expose an endpoint, whereas forgetting @Public() merely makes a
 * public route return 401, which is noticed immediately.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Publishes the scope on the request so that @CurrentScope() can retrieve it
   * without every controller having to unwrap `request.user`.
   */
  override handleRequest<TUser = AccessScope>(
    err: Error | null,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const scope = super.handleRequest(err, user, info, context) as TUser;
    const request = context.switchToHttp().getRequest<RequestWithScope>();
    request.accessScope = scope as AccessScope;
    return scope;
  }
}
