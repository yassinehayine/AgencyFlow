import { Role } from '@agencyflow/contracts';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtClaims } from '@agencyflow/contracts';

import { JwtStrategy } from './jwt.strategy';
import type { AppConfigService } from '../config/app-config.service';
import type { AuthenticatedUserLookup } from './authenticated-user.port';

/**
 * ADR-0005 in test form.
 *
 * The whole point of the change is that the TOKEN no longer decides anything
 * except who is calling. These tests are written to fail if anyone ever
 * "optimises" the lookup away and goes back to reading `claims.role`.
 */
function build(lookupResult: Awaited<ReturnType<AuthenticatedUserLookup['findActiveById']>>) {
  const users = { findActiveById: jest.fn().mockResolvedValue(lookupResult) };
  const config = { jwtSecret: 'a'.repeat(48) } as AppConfigService;

  return { strategy: new JwtStrategy(config, users as AuthenticatedUserLookup), users };
}

const claims = (overrides: Partial<JwtClaims> = {}): JwtClaims => ({
  sub: 'user-1',
  role: Role.ADMINISTRATOR,
  iat: 0,
  exp: 0,
  ...overrides,
});

describe('JwtStrategy.validate', () => {
  describe('the database decides, not the token', () => {
    /**
     * The regression that motivated ADR-0005. An Administrator demoted to
     * Team Member kept administrator rights until their 12-hour token expired,
     * while the person who demoted them had every reason to think it had taken
     * effect.
     */
    it('uses the current role and ignores a stale one in the token', async () => {
      const { strategy } = build({ userId: 'user-1', role: Role.TEAM_MEMBER });

      const scope = await strategy.validate(claims({ role: Role.ADMINISTRATOR }));

      expect(scope.role).toBe(Role.TEAM_MEMBER);
      expect(scope.isAdministrator()).toBe(false);
    });

    it('uses the current clientId and ignores one in the token', async () => {
      const { strategy } = build({
        userId: 'user-1',
        role: Role.CLIENT_CONTACT,
        clientId: 'org-real',
      });

      const scope = await strategy.validate(
        claims({ role: Role.CLIENT_CONTACT, clientId: 'org-forged' }),
      );

      expect(scope.clientId).toBe('org-real');
      expect(scope.projectScopeFilter()).toEqual({ clientId: 'org-real' });
    });

    it('looks the user up by the subject the signed token names', async () => {
      const { strategy, users } = build({ userId: 'user-42', role: Role.TEAM_MEMBER });

      await strategy.validate(claims({ sub: 'user-42' }));

      expect(users.findActiveById).toHaveBeenCalledWith('user-42');
    });
  });

  describe('a valid signature is not enough', () => {
    /**
     * FR-010 — deactivation must bite on the next request. The lookup returns
     * null for a deactivated, deleted or unknown user alike, so all three are
     * refused identically and none is distinguishable from the others.
     */
    it('refuses a token whose user can no longer authenticate', async () => {
      const { strategy } = build(null);

      await expect(strategy.validate(claims())).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses a token with no subject without touching the database', async () => {
      const { strategy, users } = build({ userId: 'user-1', role: Role.ADMINISTRATOR });

      await expect(strategy.validate({ ...claims(), sub: '' } as JwtClaims)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(users.findActiveById).not.toHaveBeenCalled();
    });
  });

  describe('cost', () => {
    it('performs exactly one lookup per request', async () => {
      const { strategy, users } = build({
        userId: 'user-1',
        role: Role.TEAM_MEMBER,
        clientId: undefined,
      });

      await strategy.validate(claims());

      // One indexed read is the accepted price of ADR-0005. Two would mean
      // something is resolving the user twice per request.
      expect(users.findActiveById).toHaveBeenCalledTimes(1);
    });
  });
});
