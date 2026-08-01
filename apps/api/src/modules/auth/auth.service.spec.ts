import { ErrorCode, Role, Skill } from '@agencyflow/contracts';
import { Types } from 'mongoose';
import type { JwtService } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import type { PasswordService } from '../../core/security/password.service';
import type { UserDocument } from '../users/schemas/user.schema';
import type { UsersRepository } from '../users/users.repository';

function makeUser(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    _id: new Types.ObjectId(),
    name: 'Amine Benali',
    username: 'amine.benali',
    email: 'amine@example.com',
    passwordHash: 'stored-hash',
    role: Role.TEAM_MEMBER,
    skill: Skill.BACKEND,
    isActive: true,
    ...overrides,
  } as UserDocument;
}

function build(user: UserDocument | null, passwordMatches = true) {
  const users = { findByEmailForAuthentication: jest.fn().mockResolvedValue(user) };
  const passwords = { verify: jest.fn().mockResolvedValue(passwordMatches) };
  const jwt = { sign: jest.fn().mockReturnValue('signed-token') };

  const service = new AuthService(
    users as unknown as UsersRepository,
    passwords as unknown as PasswordService,
    jwt as unknown as JwtService,
  );

  return { service, users, passwords, jwt };
}

async function expectInvalidCredentials(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(DomainException);
  await promise.catch((error: DomainException) => {
    expect(error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    expect(error.statusCode).toBe(401);
  });
}

describe('AuthService.login', () => {
  const credentials = { email: 'amine@example.com', password: 'correct-horse' };

  describe('FR-001 — failures are indistinguishable', () => {
    it('refuses an unknown address', async () => {
      const { service } = build(null);
      await expectInvalidCredentials(service.login(credentials));
    });

    it('refuses a wrong password', async () => {
      const { service } = build(makeUser(), false);
      await expectInvalidCredentials(service.login(credentials));
    });

    /**
     * A deactivated user is told the same thing as someone who mistyped their
     * password. That is a deliberate trade-off: the alternative confirms both
     * that the address is registered and that the person has left the agency.
     */
    it('refuses a deactivated account with the same message and code', async () => {
      const { service } = build(makeUser({ isActive: false }));
      await expectInvalidCredentials(service.login(credentials));
    });

    it('produces the identical message for all three', async () => {
      const messages: string[] = [];

      for (const setup of [
        () => build(null),
        () => build(makeUser(), false),
        () => build(makeUser({ isActive: false })),
      ]) {
        await setup()
          .service.login(credentials)
          .catch((error: DomainException) => messages.push(error.message));
      }

      expect(new Set(messages).size).toBe(1);
    });
  });

  describe('FR-001 — the timing channel is closed too', () => {
    /**
     * Identical responses are not enough. Skipping bcrypt for an unknown
     * address answers in about a millisecond while a known one takes a few
     * hundred, which reveals exactly what the shared message hides.
     */
    it('still spends a bcrypt comparison when the address is unknown', async () => {
      const { service, passwords } = build(null);

      await service.login(credentials).catch(() => undefined);

      expect(passwords.verify).toHaveBeenCalledTimes(1);
      expect(passwords.verify.mock.calls[0][1]).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('FR-002 — the token', () => {
    it('carries the id and role, and no clientId for internal staff', async () => {
      const user = makeUser({ role: Role.PROJECT_MANAGER, skill: undefined });
      const { service, jwt } = build(user);

      await service.login(credentials);

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: user._id.toString(),
        role: Role.PROJECT_MANAGER,
      });
    });

    /** The BR-10 anchor. It originates here and is never read from a request. */
    it('carries clientId for a client contact', async () => {
      const organisation = new Types.ObjectId();
      const user = makeUser({
        role: Role.CLIENT_CONTACT,
        skill: undefined,
        clientId: organisation,
      });
      const { service, jwt } = build(user);

      await service.login(credentials);

      expect(jwt.sign.mock.calls[0][0].clientId).toBe(organisation.toString());
    });

    it('never returns the password hash with the user', async () => {
      const { service } = build(makeUser());

      const response = await service.login(credentials);

      expect(response.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(response)).not.toContain('stored-hash');
    });
  });
});
