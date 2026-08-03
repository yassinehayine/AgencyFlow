import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.validation';

/**
 * Global configuration module.
 *
 * Marked @Global because configuration is genuinely cross-cutting: every
 * module needs it and none of them own it. This is a core module and, per
 * rule R2 (05-Software-Architecture.md section 7.1), it depends on no
 * feature module.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Checked in order, first match wins. `apps/api/.env` allows the API to
      // be configured on its own; `../../.env` is the shared monorepo file
      // used in local development. In production neither exists — Railway
      // supplies the variables directly, and validation is identical.
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
