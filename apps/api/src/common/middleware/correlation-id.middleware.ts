import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Header name, shared with the response so a user can quote it in a report. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

/**
 * Attaches one id to every request, for logs and for the error envelope
 * (08-Backend-Design.md section 5.1).
 *
 * This is MIDDLEWARE rather than an interceptor on purpose: middleware runs
 * before guards, so a request rejected by `JwtAuthGuard` still carries an id.
 * An interceptor runs after them, and the 401s — the errors most worth
 * tracing — would be the ones without an identifier.
 *
 * An incoming header is honoured so a chain of calls shares one id; absent
 * that, a UUID is generated.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelationId, response: Response, next: NextFunction): void {
    const incoming = request.headers[CORRELATION_ID_HEADER];
    const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
