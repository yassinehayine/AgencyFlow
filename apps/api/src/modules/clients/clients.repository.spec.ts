import { Role } from '@agencyflow/contracts';
import { Types, type Model } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ClientsRepository } from './clients.repository';
import type { ClientDocument } from './schemas/client.schema';

/**
 * `clients` is where BR-10 is at its most literal: for a Client Contact,
 * "their own organisation" is a single document. If this filter is wrong,
 * every organisation in the agency is readable by every client — so it is
 * tested directly rather than only through the endpoints above it.
 */
class TestableClientsRepository extends ClientsRepository {
  expose(scope: AccessScope) {
    return this.buildFilter(scope);
  }
}

function build(): TestableClientsRepository {
  return new TestableClientsRepository({} as Model<ClientDocument>);
}

const scopeFor = (role: Role, clientId?: string) =>
  AccessScope.forUser({ userId: new Types.ObjectId().toString(), role, clientId });

describe('ClientsRepository scope', () => {
  it.each([Role.ADMINISTRATOR, Role.PROJECT_MANAGER, Role.TEAM_MEMBER])(
    'places no organisation restriction on %s',
    (role) => {
      expect(build().expose(scopeFor(role))).toEqual({ deletedAt: null });
    },
  );

  it('restricts a client contact to their own organisation', () => {
    const organisation = new Types.ObjectId().toString();
    const filter = build().expose(scopeFor(Role.CLIENT_CONTACT, organisation));

    expect(filter).toEqual({
      $and: [{ deletedAt: null }, { _id: new Types.ObjectId(organisation) }],
    });
  });

  /**
   * A token that says CLIENT_CONTACT but carries no organisation is
   * malformed. The safe reading is "no organisation", not "all of them" — a
   * missing filter here would be an unrestricted read of every client.
   */
  it('returns an unsatisfiable filter when the token carries no organisation', () => {
    const filter = build().expose(scopeFor(Role.CLIENT_CONTACT));

    expect(filter).toEqual({ $and: [{ deletedAt: null }, { _id: null }] });
  });

  it('does not trust a malformed organisation id from a token', () => {
    const filter = build().expose(scopeFor(Role.CLIENT_CONTACT, 'not-an-object-id'));

    expect(filter).toEqual({ $and: [{ deletedAt: null }, { _id: null }] });
  });
});
