import { Global, Module } from '@nestjs/common';

import { AUTHENTICATED_USER_LOOKUP } from '../../core/authorization/authenticated-user.port';
import { UsersModule } from './users.module';
import { UsersRepository } from './users.repository';

/**
 * Binds the core authentication port to its implementation (ADR-0005).
 *
 * This exists as its own module, and is the only `@Global()` feature-side
 * module in the system, because of a genuine constraint: `JwtStrategy` lives
 * in the core `AuthorizationModule`, which must not import a feature module
 * (architecture rule R1). The dependency is therefore inverted — core declares
 * `AuthenticatedUserLookup`, `UsersRepository` implements it, and this module
 * is the single wire between them.
 *
 * Kept separate from `UsersModule` deliberately. Making `UsersModule` itself
 * global would export its whole surface everywhere and quietly dissolve the
 * module boundary; this exports exactly one token, and its name says what that
 * token is for.
 */
@Global()
@Module({
  imports: [UsersModule],
  providers: [{ provide: AUTHENTICATED_USER_LOOKUP, useExisting: UsersRepository }],
  exports: [AUTHENTICATED_USER_LOOKUP],
})
export class AuthenticatedUserLookupModule {}
