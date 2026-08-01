import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Login and session issuance (08-Backend-Design.md section 1.2).
 *
 * Depends on `UsersModule`, never the reverse. `JwtModule` and
 * `PasswordService` arrive from the global core modules, which is what keeps
 * this dependency one-directional (architecture rule R2).
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
