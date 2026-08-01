import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { DomainExceptionFilter } from './filters/domain-exception.filter';

/**
 * Cross-cutting HTTP concerns (08-Backend-Design.md section 1.1).
 *
 * Registered once, globally. A filter that each controller had to remember to
 * apply is a filter that some controller will not apply, and the failure mode
 * there is a leaked stack trace rather than a visible bug.
 */
@Module({
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // `*splat` is the Express 5 wildcard. Express 5 replaced path-to-regexp v0
    // with v8, which rejects a bare `*` — the old syntax throws at boot rather
    // than silently matching nothing, which is at least an honest failure.
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
