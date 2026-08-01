import { Role } from '@agencyflow/contracts';

import type { AuthenticatedUserRecord } from './authenticated-user.port';

/**
 * Sentinel user id for trusted internal work. Not an ObjectId on purpose: it
 * cannot collide with a real user, and a stray attempt to store it as one
 * fails loudly at the cast rather than creating a phantom account.
 */
export const SYSTEM_ACTOR_ID = 'system';

/**
 * The authorisation context of a single request.
 *
 * This is the mechanism that makes BR-10 structural rather than remembered
 * (05-Software-Architecture.md section 11.3). It is constructed once per
 * request from the user record identified by the VERIFIED JWT: `clientId` is
 * never read from a request body, a query parameter or a path segment,
 * because a client-supplied organisation id would defeat isolation entirely.
 *
 * The token supplies the identity; the database supplies the permissions
 * (ADR-0005).
 *
 * Every ScopedRepository method requires one. There is no overload without it,
 * so forgetting the scope is a compile error rather than a data leak.
 */
export class AccessScope {
  private constructor(
    readonly userId: string,
    readonly role: Role,
    readonly clientId?: string,
    /**
     * Ids of the projects this scope can reach, resolved lazily.
     *
     * `undefined` means NOT YET RESOLVED — not "none". Collections that hang
     * off a project (tasks, deliverables, files) carry no `clientId` of their
     * own, so they can only be scoped once this is known, and they must treat
     * `undefined` as "match nothing" rather than "match everything"
     * (08-Backend-Design §3.3).
     */
    readonly accessibleProjectIds?: readonly string[],
  ) {}

  /**
   * Builds a scope for a user whose record has just been re-read from the
   * database. The only supported entry point for a real request.
   *
   * Named `forUser` and not `fromClaims` for a reason worth stating: the
   * signed token establishes WHO is calling, and nothing more. `role` and
   * `clientId` are read from the current record, so a role change or a
   * deactivation takes effect on the next request rather than at token expiry
   * (FR-009, ADR-0005). A scope built from claims would be a scope built from
   * a snapshot up to twelve hours old.
   */
  static forUser(user: AuthenticatedUserRecord): AccessScope {
    return new AccessScope(user.userId, user.role, user.clientId);
  }

  /**
   * Escalated scope for trusted internal work with no acting user - seeding,
   * migrations, scheduled maintenance. Deliberately verbose to name at the
   * call site: it bypasses every filter below.
   */
  static systemScope(): AccessScope {
    return new AccessScope(SYSTEM_ACTOR_ID, Role.ADMINISTRATOR);
  }

  /**
   * The user id to record in `createdBy` / `updatedBy` / `deletedBy`, or
   * `null` when there is no acting user.
   *
   * The audit fields are `ObjectId | null` (06-Database-Design.md section 5.1)
   * and the system sentinel is not an ObjectId, so writing `userId` blindly
   * would make every seeded record fail to cast. `null` is the documented
   * value for exactly this case.
   */
  get actorId(): string | null {
    return this.userId === SYSTEM_ACTOR_ID ? null : this.userId;
  }

  /**
   * Returns a NEW scope carrying the resolved project ids.
   *
   * Immutable on purpose. Mutating the scope in place would mean a value that
   * is safe when read at one point in a request and wider when read at
   * another — and the whole reason `AccessScope` is a value object is that it
   * cannot change under anyone's feet.
   *
   * An Administrator is left unresolved: they are unrestricted, so a list of
   * every project id in the system would be an expensive way to say `{}`.
   */
  withAccessibleProjects(projectIds: readonly string[]): AccessScope {
    return new AccessScope(this.userId, this.role, this.clientId, projectIds);
  }

  isAdministrator(): boolean {
    return this.role === Role.ADMINISTRATOR;
  }

  isProjectManager(): boolean {
    return this.role === Role.PROJECT_MANAGER;
  }

  isTeamMember(): boolean {
    return this.role === Role.TEAM_MEMBER;
  }

  isClientContact(): boolean {
    return this.role === Role.CLIENT_CONTACT;
  }

  /** True for agency staff; false for external client contacts. */
  isInternal(): boolean {
    return !this.isClientContact();
  }

  /**
   * Filter fragment restricting the `projects` collection to what this scope
   * may see. Defined once here rather than in each repository, so the four
   * visibility rules cannot drift apart:
   *
   *   Administrator   - everything
   *   Project Manager - projects they own            (BR-25)
   *   Team Member     - projects they belong to      (BR-26)
   *   Client Contact  - their own organisation only  (BR-10)
   */
  projectScopeFilter(): Record<string, unknown> {
    if (this.isAdministrator()) {
      return {};
    }

    if (this.isProjectManager()) {
      return { projectManagerId: this.userId };
    }

    if (this.isTeamMember()) {
      return { 'teamMembers.userId': this.userId };
    }

    // Client Contact. `clientId` is guaranteed present for this role by the
    // token contract; its absence means a malformed token, and returning an
    // unsatisfiable filter is the safe failure mode.
    return this.clientId ? { clientId: this.clientId } : { _id: null };
  }

  /**
   * Filter fragment for collections that carry a `projectId` and are reachable
   * by client contacts only through their organisation. Callers combine this
   * with a project-id set resolved from `projectScopeFilter()`.
   */
  clientOwnershipFilter(): Record<string, unknown> {
    return this.isClientContact() ? { clientId: this.clientId ?? null } : {};
  }
}
