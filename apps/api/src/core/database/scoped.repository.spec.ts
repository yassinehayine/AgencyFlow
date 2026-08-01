import { Role } from '@agencyflow/contracts';
import type { FilterQuery, Model } from 'mongoose';

import { AccessScope } from '../authorization/access-scope';
import { ScopedRepository } from './scoped.repository';

interface TestDoc {
  _id: string;
  clientId?: string;
  deletedAt?: Date | null;
}

/**
 * Two probes rather than one, because the two scope shapes fail differently:
 * a scope that constrains a field the caller never mentions, and a scope that
 * constrains the SAME field the caller already pinned.
 */
class OrganisationScopedRepository extends ScopedRepository<TestDoc> {
  constructor() {
    super({} as Model<TestDoc>);
  }

  protected scopeFilter(scope: AccessScope): FilterQuery<TestDoc> {
    return scope.isClientContact() ? { clientId: scope.clientId } : {};
  }

  expose(scope: AccessScope, filter?: FilterQuery<TestDoc>, includeDeleted?: boolean) {
    return this.buildFilter(scope, filter, { includeDeleted });
  }
}

/** The shape that exposed the defect: the scope pins `_id` to the caller. */
class SelfOnlyRepository extends ScopedRepository<TestDoc> {
  constructor() {
    super({} as Model<TestDoc>);
  }

  protected scopeFilter(scope: AccessScope): FilterQuery<TestDoc> {
    return scope.isClientContact() ? { _id: scope.userId } : {};
  }

  expose(scope: AccessScope, filter?: FilterQuery<TestDoc>) {
    return this.buildFilter(scope, filter);
  }
}

const claims = (role: Role, clientId?: string) => ({
  sub: 'user-1',
  role,
  clientId,
  iat: 0,
  exp: 0,
});

describe('ScopedRepository.buildFilter', () => {
  describe('soft delete', () => {
    it('excludes deleted records by default', () => {
      const repository = new OrganisationScopedRepository();
      const filter = repository.expose(AccessScope.fromClaims(claims(Role.ADMINISTRATOR)));

      expect(filter).toEqual({ deletedAt: null });
    });

    it('includes them only when asked by name', () => {
      const repository = new OrganisationScopedRepository();
      const filter = repository.expose(
        AccessScope.fromClaims(claims(Role.ADMINISTRATOR)),
        undefined,
        true,
      );

      expect(filter).toEqual({});
    });
  });

  describe('scope narrowing', () => {
    it('adds the organisation constraint for a client contact', () => {
      const repository = new OrganisationScopedRepository();
      const filter = repository.expose(
        AccessScope.fromClaims(claims(Role.CLIENT_CONTACT, 'org-1')),
      );

      expect(filter).toEqual({ $and: [{ deletedAt: null }, { clientId: 'org-1' }] });
    });

    it('cannot be widened by a caller filter naming the same field', () => {
      const repository = new OrganisationScopedRepository();
      const filter = repository.expose(
        AccessScope.fromClaims(claims(Role.CLIENT_CONTACT, 'org-1')),
        {
          clientId: 'org-2',
        },
      );

      // Both clauses survive, so the query asks for a document belonging to
      // two organisations at once and matches nothing. Under an object spread
      // one of them would have been dropped.
      expect(filter).toEqual({
        $and: [{ clientId: 'org-2' }, { deletedAt: null }, { clientId: 'org-1' }],
      });
    });

    /**
     * The regression this suite exists for.
     *
     * `findById` puts the requested `_id` in the caller filter. When the scope
     * ALSO pins `_id`, an object spread let the scope overwrite it - so asking
     * for someone else's record returned your own, with a 200. Returning the
     * wrong record is worse than returning none: the caller has no way to tell.
     */
    it('does not let a scope overwrite the id being looked up', () => {
      const repository = new SelfOnlyRepository();
      const filter = repository.expose(
        AccessScope.fromClaims(claims(Role.CLIENT_CONTACT, 'org-1')),
        {
          _id: 'someone-else',
        },
      );

      expect(filter).toEqual({
        $and: [{ _id: 'someone-else' }, { deletedAt: null }, { _id: 'user-1' }],
      });
      expect(filter).not.toEqual({ _id: 'user-1', deletedAt: null });
    });
  });

  describe('query shape', () => {
    it('returns a bare object rather than an empty $and', () => {
      const repository = new OrganisationScopedRepository();
      const filter = repository.expose(
        AccessScope.fromClaims(claims(Role.ADMINISTRATOR)),
        undefined,
        true,
      );

      // MongoDB rejects `{ $and: [] }` outright.
      expect(filter).not.toHaveProperty('$and');
    });

    it('does not wrap a single clause', () => {
      const repository = new OrganisationScopedRepository();
      const filter = repository.expose(AccessScope.fromClaims(claims(Role.ADMINISTRATOR)));

      expect(filter).toEqual({ deletedAt: null });
    });
  });
});
