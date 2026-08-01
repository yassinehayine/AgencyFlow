import { ErrorCode, Role, Skill } from '@agencyflow/contracts';
import { Types } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { PasswordService } from '../../core/security/password.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { UsersService } from './users.service';
import type { UsersRepository } from './users.repository';
import type { UserDocument } from './schemas/user.schema';

/**
 * Rule tests, not persistence tests.
 *
 * The repository is a double on purpose: what needs proving here is that
 * CIR-1, BR-33 and the uniqueness contract hold, and those are decisions the
 * service makes before any query runs. Whether Mongo honours a partial unique
 * index is a different question, answered by the index definition and by
 * running against a real database.
 */
type RepositoryDouble = {
  [K in keyof UsersRepository]?: jest.Mock;
};

const adminScope = AccessScope.forUser({
  userId: new Types.ObjectId().toString(),
  role: Role.ADMINISTRATOR,
});

function makeUser(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    _id: new Types.ObjectId(),
    name: 'Amine Benali',
    username: 'amine.benali',
    email: 'amine@example.com',
    role: Role.TEAM_MEMBER,
    skill: Skill.BACKEND,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserDocument;
}

function buildService(repository: RepositoryDouble) {
  const passwords = {
    hash: jest.fn().mockResolvedValue('hashed'),
    verify: jest.fn().mockResolvedValue(true),
  };

  const service = new UsersService(
    repository as unknown as UsersRepository,
    passwords as unknown as PasswordService,
  );

  return { service, passwords };
}

/** Asserts the domain code, not just that something was thrown. */
async function expectDomainCode(promise: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(DomainException);
  await promise.catch((error: DomainException) => expect(error.code).toBe(code));
}

describe('UsersService', () => {
  describe('createStaff — CIR-1, the skill/role biconditional', () => {
    it('refuses a Team Member without a skill', async () => {
      const { service } = buildService({});

      await expectDomainCode(
        service.createStaff(
          {
            name: 'Amine',
            username: 'amine',
            email: 'a@b.com',
            password: 'longenough',
            role: Role.TEAM_MEMBER,
          },
          adminScope,
        ),
        ErrorCode.SKILL_REQUIRED,
      );
    });

    it('refuses a skill on a role that may not carry one', async () => {
      const { service } = buildService({});

      await expectDomainCode(
        service.createStaff(
          {
            name: 'Salma',
            username: 'salma',
            email: 's@b.com',
            password: 'longenough',
            role: Role.PROJECT_MANAGER,
            skill: Skill.QA,
          },
          adminScope,
        ),
        ErrorCode.SKILL_NOT_APPLICABLE,
      );
    });

    /**
     * The half that is easy to forget. A `skill` sent alongside a
     * non-Team-Member role must not merely be ignored - it must not be
     * persisted, or filtering by skill later returns an Administrator.
     */
    it('does not persist a skill for a non-Team-Member even if one slipped past', async () => {
      const create = jest.fn().mockResolvedValue(makeUser({ role: Role.PROJECT_MANAGER }));
      const { service } = buildService({
        emailExists: jest.fn().mockResolvedValue(false),
        usernameExists: jest.fn().mockResolvedValue(false),
        create,
      });

      await service.createStaff(
        {
          name: 'Salma',
          username: 'salma',
          email: 's@b.com',
          password: 'longenough',
          role: Role.PROJECT_MANAGER,
        },
        adminScope,
      );

      expect(create.mock.calls[0][0]).not.toHaveProperty('skill');
    });

    it('hashes the password and never stores the plaintext', async () => {
      const create = jest.fn().mockResolvedValue(makeUser());
      const { service, passwords } = buildService({
        emailExists: jest.fn().mockResolvedValue(false),
        usernameExists: jest.fn().mockResolvedValue(false),
        create,
      });

      await service.createStaff(
        {
          name: 'Amine',
          username: 'amine',
          email: 'a@b.com',
          password: 'plaintext-secret',
          role: Role.TEAM_MEMBER,
          skill: Skill.BACKEND,
        },
        adminScope,
      );

      expect(passwords.hash).toHaveBeenCalledWith('plaintext-secret');
      const persisted = create.mock.calls[0][0] as Record<string, unknown>;
      expect(persisted.passwordHash).toBe('hashed');
      expect(JSON.stringify(persisted)).not.toContain('plaintext-secret');
    });
  });

  describe('createStaff — uniqueness', () => {
    it('names the email as the field that clashed', async () => {
      const { service } = buildService({ emailExists: jest.fn().mockResolvedValue(true) });

      await expectDomainCode(
        service.createStaff(
          {
            name: 'Amine',
            username: 'amine',
            email: 'taken@b.com',
            password: 'longenough',
            role: Role.PROJECT_MANAGER,
          },
          adminScope,
        ),
        ErrorCode.EMAIL_ALREADY_EXISTS,
      );
    });

    it('names the username as the field that clashed', async () => {
      const { service } = buildService({
        emailExists: jest.fn().mockResolvedValue(false),
        usernameExists: jest.fn().mockResolvedValue(true),
      });

      await expectDomainCode(
        service.createStaff(
          {
            name: 'Amine',
            username: 'taken',
            email: 'free@b.com',
            password: 'longenough',
            role: Role.PROJECT_MANAGER,
          },
          adminScope,
        ),
        ErrorCode.USERNAME_ALREADY_EXISTS,
      );
    });
  });

  describe('createClientContact — CIR-2', () => {
    it('fixes the role and takes the organisation from the path, not the body', async () => {
      const create = jest.fn().mockResolvedValue(makeUser({ role: Role.CLIENT_CONTACT }));
      const { service } = buildService({
        emailExists: jest.fn().mockResolvedValue(false),
        usernameExists: jest.fn().mockResolvedValue(false),
        create,
      });

      const clientId = new Types.ObjectId().toString();

      await service.createClientContact(
        { name: 'Karim', username: 'karim', email: 'k@c.com', password: 'longenough' },
        clientId,
        adminScope,
      );

      const persisted = create.mock.calls[0][0] as Record<string, unknown>;
      expect(persisted.role).toBe(Role.CLIENT_CONTACT);
      expect(String(persisted.clientId)).toBe(clientId);
      expect(persisted).not.toHaveProperty('skill');
    });
  });

  describe('update — BR-33 username immutability', () => {
    it('refuses a different username with a reason rather than a generic error', async () => {
      const existing = makeUser();
      const { service } = buildService({ findById: jest.fn().mockResolvedValue(existing) });

      await expectDomainCode(
        service.update(existing._id.toString(), { username: 'renamed' }, adminScope),
        ErrorCode.USERNAME_IMMUTABLE,
      );
    });

    it('accepts the unchanged username, so a full-object PATCH is not punished', async () => {
      const existing = makeUser();
      const { service } = buildService({
        findById: jest.fn().mockResolvedValue(existing),
        updateById: jest.fn().mockResolvedValue(existing),
      });

      await expect(
        service.update(existing._id.toString(), { username: existing.username }, adminScope),
      ).resolves.toBeDefined();
    });
  });

  describe('update — role and skill move together', () => {
    it('keeps the existing skill when only the name changes', async () => {
      const existing = makeUser();
      const updateById = jest.fn().mockResolvedValue(existing);
      const { service } = buildService({
        findById: jest.fn().mockResolvedValue(existing),
        updateById,
      });

      await service.update(existing._id.toString(), { name: 'Amine B.' }, adminScope);

      expect(updateById.mock.calls[0][1].$set.skill).toBe(Skill.BACKEND);
    });

    /**
     * Promotion is where CIR-1 breaks quietly: the role no longer permits a
     * skill, but the old value is still on the document. `$set: undefined` is
     * a no-op in Mongo, so the field has to be removed explicitly.
     */
    it('unsets the skill when a Team Member is promoted', async () => {
      const existing = makeUser();
      const updateById = jest.fn().mockResolvedValue(existing);
      const { service } = buildService({
        findById: jest.fn().mockResolvedValue(existing),
        updateById,
      });

      await service.update(existing._id.toString(), { role: Role.PROJECT_MANAGER }, adminScope);

      const update = updateById.mock.calls[0][1] as Record<string, unknown>;
      expect(update.$unset).toEqual({ skill: '' });
      expect(update.$set).not.toHaveProperty('skill');
    });

    it('refuses a demotion to Team Member with no skill to assign', async () => {
      const existing = makeUser({ role: Role.PROJECT_MANAGER, skill: undefined });
      const { service } = buildService({ findById: jest.fn().mockResolvedValue(existing) });

      await expectDomainCode(
        service.update(existing._id.toString(), { role: Role.TEAM_MEMBER }, adminScope),
        ErrorCode.SKILL_REQUIRED,
      );
    });
  });

  describe('scope failures are indistinguishable from absence', () => {
    it('reports a record outside the scope as not found, never as forbidden', async () => {
      const { service } = buildService({ findById: jest.fn().mockResolvedValue(null) });

      await expectDomainCode(
        service.findById(new Types.ObjectId().toString(), adminScope),
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    });
  });

  describe('changeOwnPassword — FR-005', () => {
    it('refuses when the current password does not match', async () => {
      const user = makeUser();
      const { service, passwords } = buildService({
        findByIdForAuthentication: jest.fn().mockResolvedValue({ ...user, passwordHash: 'stored' }),
      });
      passwords.verify.mockResolvedValue(false);

      await expectDomainCode(
        service.changeOwnPassword(
          { currentPassword: 'wrong', newPassword: 'longenough' },
          adminScope,
        ),
        ErrorCode.CURRENT_PASSWORD_INCORRECT,
      );
    });

    it('changes the password of the caller and of nobody else', async () => {
      const user = makeUser();
      const updateById = jest.fn().mockResolvedValue(user);
      const { service } = buildService({
        findByIdForAuthentication: jest.fn().mockResolvedValue({ ...user, passwordHash: 'stored' }),
        updateById,
      });

      await service.changeOwnPassword(
        { currentPassword: 'right', newPassword: 'longenough' },
        adminScope,
      );

      // The id comes from the verified token, not from any argument.
      expect(updateById.mock.calls[0][0]).toBe(adminScope.userId);
    });
  });

  describe('search input is escaped', () => {
    it('treats regex metacharacters as literal text', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ findMany, count: jest.fn().mockResolvedValue(0) });

      await service.findAll(
        { page: 1, pageSize: 20, sortOrder: 'asc', skip: 0, search: 'a.*b' },
        adminScope,
      );

      const filter = findMany.mock.calls[0][0] as { $or: { name: RegExp }[] };
      expect(filter.$or[0].name.source).toBe('a\\.\\*b');
      expect(filter.$or[0].name.test('axxb')).toBe(false);
      expect(filter.$or[0].name.test('a.*b')).toBe(true);
    });
  });
});
