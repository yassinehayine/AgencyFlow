import { Global, Module } from '@nestjs/common';

import { PasswordService } from './password.service';

/**
 * Core security primitives, available everywhere.
 *
 * Global because two unrelated modules need hashing — `UsersModule` when an
 * account is created and `AuthModule` when one logs in — and importing a core
 * module in each consumer adds noise without adding a boundary.
 */
@Global()
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class SecurityModule {}
