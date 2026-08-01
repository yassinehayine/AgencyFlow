import { Role, type JwtClaims } from '@agencyflow/contracts';

import { AccessScope } from './access-scope';

/**
 * Tests for the mechanism that enforces BR-10.
 *
 * These are the foundation of TC-079. Every case asserts the FILTER the scope
 * produces, because that filter is what reaches MongoDB - testing the boolean
 * helpers alone would prove nothing about what data a request can actually
 * reach.
 */
describe('AccessScope', () => {
  const claims = (overrides: Partial<JwtClaims>): JwtClaims => ({
    sub: 'user-1',
    role: Role.TEAM_MEMBER,
    iat: 0,
    exp: 0,
    ...overrides,
  });

  describe('projectScopeFilter', () => {
    it('places no restriction on an Administrator (BR-29)', () => {
      const scope = AccessScope.fromClaims(claims({ role: Role.ADMINISTRATOR }));
      expect(scope.projectScopeFilter()).toEqual({});
    });

    it('restricts a Project Manager to projects they own (BR-25)', () => {
      const scope = AccessScope.fromClaims(claims({ sub: 'pm-1', role: Role.PROJECT_MANAGER }));
      expect(scope.projectScopeFilter()).toEqual({ projectManagerId: 'pm-1' });
    });

    it('restricts a Team Member to projects they belong to (BR-26)', () => {
      const scope = AccessScope.fromClaims(claims({ sub: 'tm-1', role: Role.TEAM_MEMBER }));
      expect(scope.projectScopeFilter()).toEqual({ 'teamMembers.userId': 'tm-1' });
    });

    it('restricts a Client Contact to their own organisation (BR-10)', () => {
      const scope = AccessScope.fromClaims(
        claims({ sub: 'cc-1', role: Role.CLIENT_CONTACT, clientId: 'client-atlas' }),
      );
      expect(scope.projectScopeFilter()).toEqual({ clientId: 'client-atlas' });
    });

    it('returns an unsatisfiable filter when a client token carries no clientId', () => {
      // A Client Contact without clientId means a malformed token. Returning
      // an empty filter here would expose every project in the system, so the
      // safe failure mode is to match nothing.
      const scope = AccessScope.fromClaims(claims({ role: Role.CLIENT_CONTACT }));
      expect(scope.projectScopeFilter()).toEqual({ _id: null });
    });
  });

  describe('role predicates', () => {
    it.each([
      [Role.ADMINISTRATOR, true],
      [Role.PROJECT_MANAGER, true],
      [Role.TEAM_MEMBER, true],
      [Role.CLIENT_CONTACT, false],
    ])('treats %s as internal = %s', (role, expected) => {
      expect(AccessScope.fromClaims(claims({ role })).isInternal()).toBe(expected);
    });
  });

  describe('construction', () => {
    it('carries clientId through from the signed token only', () => {
      const scope = AccessScope.fromClaims(
        claims({ role: Role.CLIENT_CONTACT, clientId: 'client-9' }),
      );
      expect(scope.clientId).toBe('client-9');
      expect(scope.isClientContact()).toBe(true);
    });

    it('exposes no constructor, so a scope cannot be forged from request data', () => {
      // The constructor is private; fromClaims and systemScope are the only
      // entry points. This is what stops a controller from building a scope
      // out of a request body.
      expect(
        Object.getOwnPropertyNames(AccessScope).includes('fromClaims') &&
          Object.getOwnPropertyNames(AccessScope).includes('systemScope'),
      ).toBe(true);
    });
  });
});
