import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Role } from '@agencyflow/contracts';
import { Model, Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ScopedRepository } from '../../core/database/scoped.repository';
import { User, type UserDocument } from './schemas/user.schema';
import type {
  AuthenticatedUserLookup,
  AuthenticatedUserRecord,
} from '../../core/authorization/authenticated-user.port';

@Injectable()
export class UsersRepository
  extends ScopedRepository<UserDocument>
  implements AuthenticatedUserLookup
{
  constructor(@InjectModel(User.name) model: Model<UserDocument>) {
    super(model);
  }

  /**
   * Who may appear in a user query at all.
   *
   * Internal staff see the directory; a Client Contact sees only their own
   * record. That second line is BR-28 made structural — a client must never
   * be able to enumerate the agency's team, its skills, or its workload — and
   * it holds even if a future route forgets its `@Roles()` decorator.
   *
   * Note what this does NOT do: it does not decide who may CALL the user list.
   * That is FR-011, Administrator only, and it belongs to the route guard.
   * This layer answers the narrower question of what data exists for a caller
   * who has already been let through (05-Software-Architecture.md 11.2).
   */
  protected scopeFilter(scope: AccessScope): FilterQuery<UserDocument> {
    if (scope.isClientContact()) {
      return { _id: new Types.ObjectId(scope.userId) };
    }

    return {};
  }

  /**
   * Loads a candidate for login, WITH the password hash and WITHOUT a scope.
   *
   * Both exceptions are unavoidable and deliberately confined to this one
   * method, whose name says so:
   *
   *   - There is no scope yet. Authentication is what produces one; requiring
   *     a scope to log in would be circular.
   *   - `passwordHash` is `select: false` everywhere else (NFR-18). This is
   *     the single place that asks for it, and the caller must never let the
   *     document escape - `UsersService` maps it before returning.
   *
   * Soft-deleted users are excluded here too: deletion must end access, and
   * relying on `isActive` alone would let a deleted account authenticate.
   */
  async findByEmailForAuthentication(email: string): Promise<UserDocument | null> {
    return this.model
      .findOne({ email: email.toLowerCase().trim(), deletedAt: null })
      .select('+passwordHash')
      .exec();
  }

  /** Same exception, keyed by id — used by the change-password flow. */
  async findByIdForAuthentication(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.model.findOne({ _id: id, deletedAt: null }).select('+passwordHash').exec();
  }

  /**
   * Implements `AuthenticatedUserLookup` (ADR-0005) — called once per
   * authenticated request to rebuild the AccessScope from current data.
   *
   * The three conditions are the whole authorisation gate:
   *   `_id`        the identity the signed token names
   *   `isActive`   a deactivated account stops working immediately (FR-010)
   *   `deletedAt`  a deleted one likewise (BR-30)
   *
   * All three failures return `null`, so a caller cannot tell a deactivated
   * account from a deleted one or from an id that never existed.
   *
   * No scope parameter, and that is not an oversight: this call is what
   * PRODUCES the scope. Requiring one would be circular. It is confined to
   * this method and the two `ForAuthentication` lookups above, which are the
   * only unscoped reads in the system.
   *
   * `passwordHash` is `select: false`, so it is absent here without asking.
   */
  async findActiveById(userId: string): Promise<AuthenticatedUserRecord | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await this.model
      .findOne({ _id: userId, isActive: true, deletedAt: null })
      .select('_id role clientId')
      .exec();

    if (!user) {
      return null;
    }

    return {
      userId: user._id.toString(),
      role: user.role,
      ...(user.clientId ? { clientId: user.clientId.toString() } : {}),
    };
  }

  /**
   * Uniqueness pre-checks. The partial unique indexes are the real guarantee;
   * these exist to turn a database error into a message naming the field that
   * clashed, which is the difference between "conflict" and "this email is
   * already in use".
   */
  async emailExists(email: string): Promise<boolean> {
    const found = await this.model
      .exists({ email: email.toLowerCase().trim(), deletedAt: null })
      .exec();
    return found !== null;
  }

  async usernameExists(username: string): Promise<boolean> {
    const found = await this.model
      .exists({ username: username.toLowerCase().trim(), deletedAt: null })
      .exec();
    return found !== null;
  }

  /**
   * Counts active Administrators, ignoring the caller's scope.
   *
   * A-10 is an invariant of the system, not a view of it: the answer to "how
   * many active administrators remain" must be the true count regardless of
   * who is asking, or the check could pass because the asker cannot see the
   * others.
   */
  async countActiveAdministrators(): Promise<number> {
    return this.model
      .countDocuments({ role: Role.ADMINISTRATOR, isActive: true, deletedAt: null })
      .exec();
  }

  /** Contacts of one organisation (FR-017). */
  async findContactsOfClient(clientId: string, scope: AccessScope): Promise<UserDocument[]> {
    return this.findMany(
      { role: Role.CLIENT_CONTACT, clientId: new Types.ObjectId(clientId) },
      scope,
      { sort: { name: 1 } },
    );
  }
}
