import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@agencyflow/contracts';
import type { JwtClaims, LoginResponse } from '@agencyflow/contracts';

import { PasswordService } from '../../core/security/password.service';
import { AuthenticationFailedException } from '../../common/exceptions/domain.exception';
import { fr } from '../../i18n/fr';
import { toAuthenticatedUser } from '../users/users.mapper';
import { UsersRepository } from '../users/users.repository';
import type { LoginDto } from './dto/login.dto';
import type { UserDocument } from '../users/schemas/user.schema';

/**
 * A real bcrypt hash of a value nobody can supply.
 *
 * Used to spend the same time on an unknown address as on a known one. Without
 * it, an unknown email skips bcrypt entirely and answers in about a
 * millisecond while a known one takes a few hundred — which turns the login
 * endpoint into an oracle for "is this person a client of this agency", the
 * exact disclosure FR-001's generic message exists to prevent. Answering
 * identically is not enough if the answers arrive at different times.
 */
const TIMING_EQUALISER_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5uMPKQvfxL8Q/rGcVBnc8kSj4jMzTLK';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * FR-001, FR-002 — exchange credentials for a 12-hour token.
   *
   * Three different failures — unknown address, wrong password, deactivated
   * account — produce one identical response. That is deliberate and it is a
   * genuine trade-off: a deactivated employee is told "incorrect email or
   * password" rather than the truth. Naming the real cause would let anyone
   * enumerate which addresses are registered and which staff have left, and
   * the deactivated user's own administrator already knows why.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.users.findByEmailForAuthentication(dto.email);

    const passwordMatches = await this.passwords.verify(
      dto.password,
      user?.passwordHash ?? TIMING_EQUALISER_HASH,
    );

    if (!user || !passwordMatches || !user.isActive) {
      throw new AuthenticationFailedException(
        ErrorCode.INVALID_CREDENTIALS,
        fr.auth.invalidCredentials,
      );
    }

    return {
      accessToken: this.jwt.sign(this.claimsFor(user)),
      user: toAuthenticatedUser(user),
    };
  }

  /**
   * The claims, and nothing more.
   *
   * `clientId` is present only for a Client Contact and originates here, from
   * the database record, at the one moment identity is established. Every
   * later authorisation decision reads it from the signed token — which is
   * what makes BR-10 unforgeable rather than merely enforced.
   *
   * Nothing else is included. A claim is a cached copy of a database row, and
   * every extra field is one more thing that can go stale for the token's
   * whole 12-hour life.
   *
   * ⚠️ KNOWN GAP, raised for decision. Because `role` and `isActive` are read
   * from the token, a role change or a deactivation does not take effect until
   * the current token expires — up to 12 hours. FR-009's acceptance criterion
   * says permissions change "on the next request", which a stateless token
   * cannot deliver. Closing it means re-reading the user on every request in
   * `JwtStrategy`, which is one indexed lookup per call and a change to the
   * approved "scope from the token and nothing else" rule. Not decided here.
   */
  private claimsFor(user: UserDocument): Omit<JwtClaims, 'iat' | 'exp'> {
    return {
      sub: user._id.toString(),
      role: user.role,
      ...(user.clientId ? { clientId: user.clientId.toString() } : {}),
    };
  }
}
