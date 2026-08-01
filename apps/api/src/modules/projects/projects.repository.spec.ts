import { Role } from '@agencyflow/contracts';
import { Types, type Model } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ProjectsRepository } from './projects.repository';
import type { ProjectDocument } from './schemas/project.schema';

/**
 * FR-025 has four different answers for four roles, and getting any one of
 * them wrong exposes another organisation's work. The filter is asserted
 * directly rather than only through endpoints, because that filter is what
 * reaches MongoDB.
 */
class TestableProjectsRepository extends ProjectsRepository {
  expose(scope: AccessScope) {
    return this.buildFilter(scope);
  }
}

const build = () => new TestableProjectsRepository({} as Model<ProjectDocument>);

const scopeFor = (role: Role, userId = 'user-1', clientId?: string) =>
  AccessScope.forUser({ userId, role, clientId });

describe('ProjectsRepository scope — FR-025', () => {
  it('places no restriction on an Administrator (BR-29)', () => {
    expect(build().expose(scopeFor(Role.ADMINISTRATOR))).toEqual({ deletedAt: null });
  });

  it('restricts a Project Manager to projects they own (BR-25)', () => {
    expect(build().expose(scopeFor(Role.PROJECT_MANAGER, 'pm-1'))).toEqual({
      $and: [{ deletedAt: null }, { projectManagerId: 'pm-1' }],
    });
  });

  it('restricts a Team Member to projects they belong to (BR-26)', () => {
    expect(build().expose(scopeFor(Role.TEAM_MEMBER, 'tm-1'))).toEqual({
      $and: [{ deletedAt: null }, { 'teamMembers.userId': 'tm-1' }],
    });
  });

  it('restricts a Client Contact to their own organisation (BR-10)', () => {
    expect(build().expose(scopeFor(Role.CLIENT_CONTACT, 'cc-1', 'org-atlas'))).toEqual({
      $and: [{ deletedAt: null }, { clientId: 'org-atlas' }],
    });
  });

  /**
   * The failure that would matter most. A CLIENT_CONTACT token with no
   * organisation is malformed; reading it as "no restriction" would hand one
   * client every project in the agency.
   */
  it('matches nothing when a client token carries no organisation', () => {
    expect(build().expose(scopeFor(Role.CLIENT_CONTACT, 'cc-1'))).toEqual({
      $and: [{ deletedAt: null }, { _id: null }],
    });
  });

  describe('accessibleProjectIds', () => {
    /**
     * `null` and `[]` must stay distinct. Both are falsy, and a caller writing
     * `if (!ids)` would treat a user who belongs to no project as an
     * administrator — a privilege escalation caused by a truthiness check.
     */
    it('returns null for an Administrator, meaning no restriction', async () => {
      const repository = build();

      await expect(
        repository.accessibleProjectIds(scopeFor(Role.ADMINISTRATOR)),
      ).resolves.toBeNull();
    });

    it('returns an array for a restricted role, even when it is empty', async () => {
      const repository = new TestableProjectsRepository({
        find: () => ({
          select: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
        }),
      } as unknown as Model<ProjectDocument>);

      const ids = await repository.accessibleProjectIds(scopeFor(Role.TEAM_MEMBER, 'tm-1'));

      expect(ids).toEqual([]);
      expect(ids).not.toBeNull();
    });

    it('maps the documents it finds to their ids', async () => {
      const first = new Types.ObjectId();
      const second = new Types.ObjectId();

      const repository = new TestableProjectsRepository({
        find: () => ({
          select: () => ({
            lean: () => ({ exec: () => Promise.resolve([{ _id: first }, { _id: second }]) }),
          }),
        }),
      } as unknown as Model<ProjectDocument>);

      await expect(
        repository.accessibleProjectIds(scopeFor(Role.PROJECT_MANAGER)),
      ).resolves.toEqual([first, second]);
    });
  });
});
