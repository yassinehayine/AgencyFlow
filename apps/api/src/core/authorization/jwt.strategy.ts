import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtClaims } from '@agencyflow/contracts';

import { AppConfigService } from '../config/app-config.service';
import { AccessScope } from './access-scope';

/**
 * Verifies the bearer token and turns its claims into an AccessScope.
 *
 * The scope is derived here, at the one point where the signature has just
 * been checked. Nothing downstream can influence it.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: AppConfigService) {
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
  validate(claims: JwtClaims): AccessScope {
    if (!claims.sub || !claims.role) {
      throw new UnauthorizedException();
    }

    return AccessScope.fromClaims(claims);
  }
}
