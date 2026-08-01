import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { ErrorCode } from '@agencyflow/contracts';
import type { ApiErrorResponse } from '@agencyflow/contracts';
import type { ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { DomainException } from '../exceptions/domain.exception';
import { fr } from '../../i18n/fr';
import type { RequestWithCorrelationId } from '../middleware/correlation-id.middleware';

/** MongoDB's duplicate-key error number. */
const MONGO_DUPLICATE_KEY = 11000;

interface MongoWriteError {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

/**
 * The single exit point for every failure (08-Backend-Design.md section 5).
 *
 * One filter rather than per-controller handling, because the guarantee worth
 * having is negative: **no error path may return anything but this envelope**.
 * A leaked Mongo error or stack trace is an information disclosure (NFR-23),
 * and the only reliable way to prevent one is to give errors a single door.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithCorrelationId>();
    const response = http.getResponse<Response>();

    const correlationId = request.correlationId ?? 'unknown';
    const { statusCode, code, message, details } = this.translate(exception);

    // Only unexpected failures carry a stack worth keeping. Logging the full
    // object for an expected 404 would bury the real 500s.
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} -> ${statusCode} ${code}`,
      );
    }

    const body: ApiErrorResponse = {
      statusCode,
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details ? { details } : {}),
    };

    response.status(statusCode).json(body);
  }

  private translate(
    exception: unknown,
  ): Omit<ApiErrorResponse, 'correlationId' | 'timestamp' | 'path'> {
    // 1. Our own exceptions already carry everything the envelope needs.
    if (exception instanceof DomainException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    // 2. A duplicate key means the uniqueness check and the insert raced.
    //    Rare, but the alternative is a 500 for what is really a 409 - and
    //    the partial unique indexes exist precisely to make this reachable
    //    (06-Database-Design.md section 8.2).
    const mongoError = exception as MongoWriteError;
    if (mongoError?.code === MONGO_DUPLICATE_KEY) {
      return this.translateDuplicateKey(mongoError);
    }

    // 3. Framework exceptions - the guards, which throw before any service
    //    code runs and therefore cannot use a domain exception, and the
    //    router's own 404 for an unmatched path.
    if (exception instanceof HttpException) {
      return this.translateHttpException(exception.getStatus());
    }

    // 4. Anything else is a defect. The client is told nothing except the
    //    correlation id; the detail is in the log (NFR-23).
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: fr.common.internalError,
    };
  }

  /**
   * Maps a framework status onto the error catalogue.
   *
   * Every status is listed explicitly. An earlier version collapsed
   * "not 401" into `FORBIDDEN`, which labelled the router's 404 for an
   * unknown path as an authorisation refusal — a misleading code is worse
   * than a vague one, because the client branches on it.
   */
  private translateHttpException(
    status: number,
  ): Omit<ApiErrorResponse, 'correlationId' | 'timestamp' | 'path'> {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return {
          statusCode: status,
          code: ErrorCode.UNAUTHENTICATED,
          message: fr.auth.unauthenticated,
        };
      case HttpStatus.FORBIDDEN:
        return { statusCode: status, code: ErrorCode.FORBIDDEN, message: fr.common.forbidden };
      case HttpStatus.NOT_FOUND:
        return {
          statusCode: status,
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: fr.common.notFound,
        };
      default:
        // Any other framework status: 4xx means the request was malformed in
        // some way we have not named; 5xx is a defect and says nothing more.
        return status < HttpStatus.INTERNAL_SERVER_ERROR
          ? {
              statusCode: status,
              code: ErrorCode.VALIDATION_FAILED,
              message: fr.common.validationFailed,
            }
          : {
              statusCode: status,
              code: ErrorCode.INTERNAL_ERROR,
              message: fr.common.internalError,
            };
    }
  }

  private translateDuplicateKey(
    error: MongoWriteError,
  ): Omit<ApiErrorResponse, 'correlationId' | 'timestamp' | 'path'> {
    const field = Object.keys(error.keyPattern ?? {})[0];

    const known: Record<string, { code: ErrorCode; message: string }> = {
      email: { code: ErrorCode.EMAIL_ALREADY_EXISTS, message: fr.users.emailAlreadyExists },
      username: {
        code: ErrorCode.USERNAME_ALREADY_EXISTS,
        message: fr.users.usernameAlreadyExists,
      },
      name: { code: ErrorCode.CLIENT_NAME_ALREADY_EXISTS, message: fr.clients.nameAlreadyExists },
    };

    const mapped = known[field ?? ''];

    return {
      statusCode: HttpStatus.CONFLICT,
      code: mapped?.code ?? ErrorCode.VALIDATION_FAILED,
      message: mapped?.message ?? fr.common.validationFailed,
    };
  }
}
