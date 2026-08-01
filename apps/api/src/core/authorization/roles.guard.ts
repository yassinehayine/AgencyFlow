import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@agencyflow/contracts';
import type { Request } from 'express';

import { AccessScope } from './access-scope';
import { ROLES_KEY } from './authorization.decorators';

interface RequestWithScope extends Request {
  accessScope?: AccessScope;
}

/**
 * Layer 2 of the authorisation pipeline: may this ROLE reach this route?
 *
 * Deliberately coarse. It cannot express "the PM who owns this project"
 * (BR-25) or "a task currently in review" (BR-04), because those depend on
 * resource state and ownership that a route decorator cannot see. Those rules
 * live in services - see SD-3 in 07-UML-Design.md, where this guard correctly
 * allows a Team Member through to a task route and the service refuses the
 * operation.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithScope>();
    const scope = request.accessScope;

    if (!scope) {
      throw new ForbiddenException();
    }

    // The Administrator holds every permission; there is no separate override
    // mechanism (BR-29).
    if (scope.isAdministrator() || required.includes(scope.role)) {
      return true;
    }

    throw new ForbiddenException();
  }
}
