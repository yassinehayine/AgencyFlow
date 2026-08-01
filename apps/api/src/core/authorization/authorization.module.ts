import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JWT_EXPIRY_SECONDS } from '@agencyflow/contracts';

import { AppConfigService } from '../config/app-config.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

/**
 * Authorisation core module (05-Software-Architecture.md section 11).
 *
 * Registers layers 1 and 2 of the pipeline GLOBALLY, in order. Layers 3 and 4
 * - policy checks in services and the AccessScope applied inside repositories
 * - cannot be registered here because they are not HTTP concerns.
 */
@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        // 12 hours - a working day. No refresh token, no persistent session
        // (BR-13, NFR-19).
        signOptions: { expiresIn: JWT_EXPIRY_SECONDS },
      }),
    }),
  ],
  providers: [
    JwtStrategy,
    // Order matters: authentication establishes the scope that the roles
    // guard then reads.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, PassportModule],
})
export class AuthorizationModule {}
