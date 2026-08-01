import { Injectable } from '@nestjs/common';
import { ErrorCode, Role, Skill } from '@agencyflow/contracts';
import type { PaginatedResponse, UserDetail, UserSummary } from '@agencyflow/contracts';
import { Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { PasswordService } from '../../core/security/password.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions/domain.exception';
import { fr } from '../../i18n/fr';
import { toUserDetail, toUserSummary } from './users.mapper';
import { UsersRepository } from './users.repository';
import type { CreateClientContactDto, CreateUserDto } from './dto/create-user.dto';
import type { ChangePasswordDto, ResetPasswordDto, UpdateUserDto } from './dto/update-user.dto';
import type { UserListQueryDto } from './dto/user-list-query.dto';
import type { UserDocument } from './schemas/user.schema';

/**
 * All user business rules (05-Software-Architecture.md rule R3).
 *
 * Nothing here imports an HTTP type. The rules are expressed against the
 * domain, so they are testable without a request and would survive a change
 * of transport.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly passwords: PasswordService,
  ) {}

  // ---------------------------------------------------------------------
  // Creation
  // ---------------------------------------------------------------------

  /** FR-008 — an Administrator creates an internal staff account. */
  async createStaff(dto: CreateUserDto, scope: AccessScope): Promise<UserDetail> {
    this.assertSkillMatchesRole(dto.role, dto.skill);
    await this.assertIdentityAvailable(dto.email, dto.username);

    const created = await this.repository.create(
      {
        name: dto.name,
        username: dto.username,
        email: dto.email,
        passwordHash: await this.passwords.hash(dto.password),
        role: dto.role,
        // Written only when the role permits it, so a stray value in the
        // request cannot end up on an Administrator (CIR-1).
        ...(dto.role === Role.TEAM_MEMBER ? { skill: dto.skill } : {}),
        isActive: true,
      },
      scope,
    );

    return toUserDetail(created);
  }

  /**
   * FR-016 — an Administrator or Project Manager creates a Client Contact.
   *
   * `clientId` is a parameter, not a DTO field. The caller of this method is
   * a route nested under `/clients/:id`, so the organisation is established
   * by the path and there is no field through which a different one could be
   * requested (BR-09, BR-10, CIR-2).
   */
  async createClientContact(
    dto: CreateClientContactDto,
    clientId: string,
    scope: AccessScope,
  ): Promise<UserDetail> {
    await this.assertIdentityAvailable(dto.email, dto.username);

    const created = await this.repository.create(
      {
        name: dto.name,
        username: dto.username,
        email: dto.email,
        passwordHash: await this.passwords.hash(dto.password),
        role: Role.CLIENT_CONTACT,
        clientId: new Types.ObjectId(clientId),
        isActive: true,
      },
      scope,
    );

    return toUserDetail(created);
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  /** FR-011 — paginated, filterable list. */
  async findAll(
    query: UserListQueryDto,
    scope: AccessScope,
  ): Promise<PaginatedResponse<UserSummary>> {
    const filter = this.buildListFilter(query);

    const [documents, totalItems] = await Promise.all([
      this.repository.findMany(filter, scope, {
        skip: query.skip,
        limit: query.pageSize,
        sort: { [this.sortField(query.sortBy)]: query.sortOrder === 'desc' ? -1 : 1 },
      }),
      this.repository.count(filter, scope),
    ]);

    return paginate(documents.map(toUserSummary), totalItems, query);
  }

  async findById(id: string, scope: AccessScope): Promise<UserDetail> {
    return toUserDetail(await this.getOrFail(id, scope));
  }

  /** FR-017 — the contacts of one organisation. */
  async findContactsOfClient(clientId: string, scope: AccessScope): Promise<UserSummary[]> {
    const documents = await this.repository.findContactsOfClient(clientId, scope);
    return documents.map(toUserSummary);
  }

  // ---------------------------------------------------------------------
  // Updates
  // ---------------------------------------------------------------------

  /** FR-009 — an Administrator edits name, role and skill. */
  async update(id: string, dto: UpdateUserDto, scope: AccessScope): Promise<UserDetail> {
    const existing = await this.getOrFail(id, scope);

    if (dto.username !== undefined && dto.username !== existing.username) {
      throw new BusinessRuleViolationException(
        ErrorCode.USERNAME_IMMUTABLE,
        fr.users.usernameImmutable,
      );
    }

    // The resulting role decides whether a skill is legal, so the check runs
    // against the merged state rather than the patch. Validating the patch
    // alone would let a Team Member be promoted to Project Manager while
    // silently keeping a skill they may no longer hold (CIR-1).
    const nextRole = dto.role ?? existing.role;
    const nextSkill = nextRole === Role.TEAM_MEMBER ? (dto.skill ?? existing.skill) : dto.skill;
    this.assertSkillMatchesRole(nextRole, nextSkill);

    const updated = await this.repository.updateById(
      id,
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          role: nextRole,
          ...(nextRole === Role.TEAM_MEMBER ? { skill: nextSkill } : {}),
        },
        // A role that may not carry a skill must have the field REMOVED, not
        // set to undefined: `$set: { skill: undefined }` is a no-op in Mongo
        // and would leave the stale value in place.
        ...(nextRole === Role.TEAM_MEMBER ? {} : { $unset: { skill: '' } }),
      },
      scope,
    );

    if (!updated) {
      throw new ResourceNotFoundException(fr.users.notFound);
    }

    return toUserDetail(updated);
  }

  /** FR-006 — an Administrator resets someone else's password. */
  async resetPassword(id: string, dto: ResetPasswordDto, scope: AccessScope): Promise<void> {
    await this.getOrFail(id, scope);

    const updated = await this.repository.updateById(
      id,
      { $set: { passwordHash: await this.passwords.hash(dto.newPassword) } },
      scope,
    );

    if (!updated) {
      throw new ResourceNotFoundException(fr.users.notFound);
    }
  }

  /**
   * FR-005 — a user changes their own password.
   *
   * Takes the id from the scope, never from a parameter: a route that let the
   * caller name the account would be a password-reset endpoint for anyone.
   */
  async changeOwnPassword(dto: ChangePasswordDto, scope: AccessScope): Promise<void> {
    const user = await this.repository.findByIdForAuthentication(scope.userId);

    if (!user) {
      throw new ResourceNotFoundException(fr.users.notFound);
    }

    const matches = await this.passwords.verify(dto.currentPassword, user.passwordHash);

    if (!matches) {
      throw new BusinessRuleViolationException(
        ErrorCode.CURRENT_PASSWORD_INCORRECT,
        fr.auth.currentPasswordIncorrect,
      );
    }

    await this.repository.updateById(
      scope.userId,
      { $set: { passwordHash: await this.passwords.hash(dto.newPassword) } },
      scope,
    );
  }

  // ---------------------------------------------------------------------
  // Shared rules
  // ---------------------------------------------------------------------

  /**
   * CIR-1 — a skill belongs to a Team Member and to nobody else.
   *
   * Both halves are enforced. Only checking the "required" half would let an
   * Administrator carry a skill, and since skills are meant to be purely
   * descriptive (BR-02), that inconsistency would quietly become a filter
   * result nobody can explain.
   */
  private assertSkillMatchesRole(role: Role, skill: Skill | undefined): void {
    if (role === Role.TEAM_MEMBER && !skill) {
      throw new BusinessRuleViolationException(ErrorCode.SKILL_REQUIRED, fr.users.skillRequired);
    }

    if (role !== Role.TEAM_MEMBER && skill) {
      throw new BusinessRuleViolationException(
        ErrorCode.SKILL_NOT_APPLICABLE,
        fr.users.skillNotApplicable,
      );
    }
  }

  /**
   * Pre-checks uniqueness so the caller learns WHICH field clashed.
   *
   * The partial unique indexes remain the actual guarantee — this check and
   * the insert are not atomic, and a concurrent create still lands on the
   * index, where the exception filter turns E11000 into the same 409.
   */
  private async assertIdentityAvailable(email: string, username: string): Promise<void> {
    if (await this.repository.emailExists(email)) {
      throw new ResourceConflictException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        fr.users.emailAlreadyExists,
      );
    }

    if (await this.repository.usernameExists(username)) {
      throw new ResourceConflictException(
        ErrorCode.USERNAME_ALREADY_EXISTS,
        fr.users.usernameAlreadyExists,
      );
    }
  }

  /**
   * Out of scope and non-existent are the same answer on purpose. A
   * distinguishable 403 would confirm the account exists (BR-10).
   */
  private async getOrFail(id: string, scope: AccessScope): Promise<UserDocument> {
    const found = await this.repository.findById(id, scope);

    if (!found) {
      throw new ResourceNotFoundException(fr.users.notFound);
    }

    return found;
  }

  /**
   * `sortBy` arrives as a free-form string, so it is matched against an
   * allow-list rather than passed through. An unrecognised value falls back to
   * `name` instead of erroring: a bad sort key is not worth failing a request
   * over, but letting the client name arbitrary document paths would turn the
   * list endpoint into an index-probing tool.
   */
  private sortField(requested: string | undefined): string {
    const sortable = ['name', 'username', 'email', 'role', 'skill', 'isActive', 'createdAt'];
    return requested && sortable.includes(requested) ? requested : 'name';
  }

  private buildListFilter(query: UserListQueryDto): FilterQuery<UserDocument> {
    const filter: FilterQuery<UserDocument> = {};

    if (query.role) filter.role = query.role;
    if (query.skill) filter.skill = query.skill;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    if (query.search) {
      // Escaped before it reaches the regex: an unescaped search term is both
      // a correctness bug (a dot matches anything) and a denial-of-service
      // vector through a catastrophically backtracking pattern.
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [{ name: pattern }, { username: pattern }, { email: pattern }];
    }

    return filter;
  }
}
