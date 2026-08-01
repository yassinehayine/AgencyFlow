import { Body, Controller, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import type { LoginResponse } from '@agencyflow/contracts';

import { AccessScope } from '../../core/authorization/access-scope';
import { CurrentScope, Public } from '../../core/authorization/authorization.decorators';
import { ChangePasswordDto } from '../users/dto/update-user.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * `/api/v1/auth` (FR-001 – FR-005).
 *
 * There is no registration route, and its absence is the implementation of
 * FR-007: accounts exist only because an Administrator created one (BR-11).
 * Nothing needs to reject self-registration because nothing accepts it.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /**
   * FR-001, FR-002.
   *
   * The only `@Public()` route besides the health probe. Authentication is
   * global by default, so this decorator is the entire list of unauthenticated
   * surface — greppable in one search.
   *
   * 200 rather than 201: login creates no resource. A token is a claim about
   * something that already exists.
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto);
  }

  /**
   * FR-004.
   *
   * Deliberately a no-op on the server, and worth being honest about rather
   * than implementing something that pretends otherwise. The token is
   * stateless with a 12-hour expiry and there is no server-side session to
   * end (BR-13); logging out means the client discards the token, which the
   * client does on its own. A server-side blocklist would need shared state
   * this architecture does not have, and would buy nothing v1 asks for.
   *
   * The route exists so the client has one place to call and so the
   * conversation shows an explicit end.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(): void {
    return;
  }

  /**
   * FR-005 — change your own password.
   *
   * The account comes from the verified token, never from the body: an
   * endpoint that let the caller name the account would be a password reset
   * for anyone.
   */
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentScope() scope: AccessScope,
  ): Promise<void> {
    return this.users.changeOwnPassword(dto, scope);
  }
}
