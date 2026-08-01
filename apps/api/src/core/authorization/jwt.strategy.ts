import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtClaims } from '@agencyflow/contracts';

import { AppConfigService } from '../config/app-config.service';
import { AccessScope } from './access-scope';
import { AUTHENTICATED_USER_LOOKUP, type AuthenticatedUserLookup } from './authenticated-user.port';

/**
 * Verifies the bearer token, then re-reads the user it names.
 *
 * **The token proves identity. The database decides permissions** (ADR-0005).
 *
 * An earlier version built the scope from the token's claims alone. That is
 * the textbook stateless design and it was wrong here, for one reason that
 * outweighs the saved query: `role` and `isActive` were frozen for the token's
 * whole twelve-hour life. A deactivated employee kept working access until
 * their token expired, and a demoted user kept the permissions they had been
 * demoted out of — while the Administrator who made the change had every
 * reason to believe it had taken effect. FR-009 says permissions change on the
 * next request, and only a lookup can deliver that.
 *
 * The cost is one indexed `_id` lookup per authenticated request. Public
 * routes never reach here at all: `JwtAuthGuard` short-circuits on `@Public()`,
 * so the health probe and login pay nothing.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    @Inject(AUTHENTICATED_USER_LOOKUP) private readonly users: AuthenticatedUserLookup,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  /**
   * Called only after the signature and expiry have been validated.
   * Passport assigns the return value to `request.user`.
   */
  async validate(claims: JwtClaims): Promise<AccessScope> {
    if (!claims.sub) {
      throw new UnauthorizedException();
    }

    const user = await this.users.findActiveById(claims.sub);

    // Covers deactivated, soft-deleted, and never-existed alike. A valid
    // signature over a user who may no longer authenticate is not an
    // authenticated request - and the three cases are deliberately
    // indistinguishable to the caller.
    if (!user) {
      throw new UnauthorizedException();
    }

    // Built from the record, not from `claims`. The claims' `role` and
    // `clientId` are ignored entirely: they are a stale copy, and reading them
    // is exactly the bug this class exists to avoid.
    return AccessScope.forUser(user);
  }
}
