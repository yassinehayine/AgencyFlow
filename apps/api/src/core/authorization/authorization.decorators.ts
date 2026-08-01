import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@agencyflow/contracts';
import type { Request } from 'express';

import { AccessScope } from './access-scope';

export const IS_PUBLIC_KEY = 'agencyflow:isPublic';
export const ROLES_KEY = 'agencyflow:roles';

/**
 * Marks a route as reachable without authentication.
 *
 * Authentication is global by default, so forgetting to protect a route is
 * impossible - exposing one is an explicit, greppable decision. Only the
 * health probe and login carry it.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restricts a route to the listed roles.
 *
 * This is the COARSE layer only (05-Software-Architecture.md section 11.2).
 * It answers "may a Project Manager reach this route", never "is this user the
 * PM of THIS project" - ownership and state rules live in services, next to
 * the business rule they enforce.
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

interface RequestWithScope extends Request {
  accessScope?: AccessScope;
}

/**
 * Injects the request's AccessScope into a controller handler.
 *
 * Throws rather than returning undefined on an unauthenticated route: a
 * handler that asked for a scope and silently received nothing would be a
 * security hole that type checking cannot catch.
 */
export const CurrentScope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessScope => {
    const request = context.switchToHttp().getRequest<RequestWithScope>();

    if (!request.accessScope) {
      throw new Error(
        'AccessScope is missing. @CurrentScope() cannot be used on a @Public() route.',
      );
    }

    return request.accessScope;
  },
);
