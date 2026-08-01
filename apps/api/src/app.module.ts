import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from './common/common.module';
import { AuthorizationModule } from './core/authorization/authorization.module';
import { AppConfigModule } from './core/config/app-config.module';
import { AppConfigService } from './core/config/app-config.service';
import { SecurityModule } from './core/security/security.module';
import { StorageModule } from './core/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { HealthModule } from './modules/health/health.module';
import { AuthenticatedUserLookupModule } from './modules/users/authenticated-user-lookup.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Application composition root.
 *
 * Dependencies flow in one direction only: HTTP -> feature modules -> core
 * (05-Software-Architecture.md section 7, rules R1 and R2). Core modules are
 * listed first here to make that ordering visible at a glance.
 */
@Module({
  imports: [
    // --- Core -------------------------------------------------------------
    AppConfigModule,
    MongooseModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.mongodbUri,
        // Fail fast on an unreachable database rather than queueing commands
        // that will never run.
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    AuthorizationModule,
    SecurityModule,
    StorageModule,
    // Correlation ids and the single error envelope. Imported with the core
    // modules because every feature depends on it and it depends on none.
    CommonModule,
    // In-process domain events (05-Software-Architecture.md section 9).
    // Business services publish facts; Activity and Notification listeners
    // subscribe, so adding an email listener later touches no business code.
    EventEmitterModule.forRoot({ global: true, wildcard: false }),

    // The one inverted dependency: core's JwtStrategy needs to re-read the
    // acting user on every request (ADR-0005), and core may not import a
    // feature. This module is the single wire between the port and its
    // implementation.
    AuthenticatedUserLookupModule,

    // --- Features ---------------------------------------------------------
    HealthModule,
    AuthModule,
    UsersModule,
    ClientsModule,
  ],
})
export class AppModule {}
