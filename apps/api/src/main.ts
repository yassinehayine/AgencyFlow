import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';
import { AppConfigService } from './core/config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  app.enableCors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // URI versioning (00-Project-Foundation.md section 12.5). `health` is
  // excluded so that platform probes hit a stable, unversioned path.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown properties rather than stripping them. Silent stripping
      // would hide an attempted privilege escalation - a client sending `role`
      // or `clientId` must get a 400, not a quietly sanitised request
      // (08-Backend-Design.md section 4.2).
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Field-level failures reach the client as `details[{ field, message }]`
      // instead of Nest's flat string array, so a form can mark the offending
      // input rather than printing a paragraph above it.
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(config.port);

  logger.log(`AgencyFlow API listening on http://localhost:${config.port}`);
  logger.log(`Environment: ${config.nodeEnv}`);
  logger.log(`Health: http://localhost:${config.port}/health`);
}

void bootstrap();
