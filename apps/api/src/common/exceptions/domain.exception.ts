import { ErrorCode } from '@agencyflow/contracts';
import type { ApiErrorDetail } from '@agencyflow/contracts';

/**
 * Domain exception hierarchy (08-Backend-Design.md section 5.2).
 *
 * Services throw these; a single global filter maps them to HTTP. That is what
 * keeps `05-Software-Architecture.md` rule R3 true — a service never imports an
 * HTTP type, so the business layer stays testable without a request object and
 * reusable behind a different transport.
 *
 * The class names deliberately differ from the Nest built-ins
 * (`NotFoundException`, `ForbiddenException`, `ConflictException`). Sharing a
 * name with a framework export invites an editor to auto-import the wrong one,
 * and the wrong one would bypass this filter and emit a bare Nest error body
 * instead of the agreed envelope. A distinct name makes that mistake
 * impossible rather than merely unlikely.
 */
export abstract class DomainException extends Error {
  abstract readonly statusCode: number;

  protected constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * 400 — the request could not be parsed into a valid DTO.
 *
 * Raised by the global `ValidationPipe` through an exception factory rather
 * than by a service, so that field-level failures arrive in the same envelope
 * as every other error instead of in Nest's default shape.
 */
export class ValidationFailedException extends DomainException {
  readonly statusCode = 400;

  constructor(message: string, details: ApiErrorDetail[]) {
    super(ErrorCode.VALIDATION_FAILED, message, details);
  }
}

/**
 * 404 — the resource does not exist, **or** it exists outside the caller's
 * AccessScope. The two must be indistinguishable: a 403 would confirm the
 * resource exists, which is itself a disclosure (BR-10).
 */
export class ResourceNotFoundException extends DomainException {
  readonly statusCode = 404;

  constructor(message: string) {
    super(ErrorCode.RESOURCE_NOT_FOUND, message);
  }
}

/** 401 — no valid identity. Never says which half of the credentials failed. */
export class AuthenticationFailedException extends DomainException {
  readonly statusCode = 401;

  constructor(code: ErrorCode, message: string) {
    super(code, message);
  }
}

/**
 * 403 — the identity is known and the action is refused.
 *
 * Correct for a role or ownership refusal on a resource the caller may
 * legitimately see. When the caller should not know the resource exists at
 * all, throw `ResourceNotFoundException` instead.
 */
export class AccessDeniedException extends DomainException {
  readonly statusCode = 403;

  constructor(message: string) {
    super(ErrorCode.FORBIDDEN, message);
  }
}

/** 409 — uniqueness or lifecycle conflict with existing data. */
export class ResourceConflictException extends DomainException {
  readonly statusCode = 409;

  constructor(code: ErrorCode, message: string) {
    super(code, message);
  }
}

/**
 * 422 — the request is well-formed and the caller is permitted, but a business
 * rule refuses it. `details` carries the information the user needs to act:
 * BR-32 lists the tasks blocking a deactivation rather than only refusing it.
 */
export class BusinessRuleViolationException extends DomainException {
  readonly statusCode = 422;

  constructor(code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(code, message, details);
  }
}
