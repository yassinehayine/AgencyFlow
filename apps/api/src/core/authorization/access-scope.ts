import { Role, type JwtClaims } from '@agencyflow/contracts';

/**
 * The authorisation context of a single request.
 *
 * This is the mechanism that makes BR-10 structural rather than remembered
 * (05-Software-Architecture.md section 11.3). It is constructed once per
 * request from the VERIFIED JWT and from nothing else: `clientId` is never
 * read from a request body, a query parameter or a path segment, because a
 * client-supplied organisation id would defeat isolation entirely.
 *
 * Every ScopedRepository method requires one. There is no overload without it,
 * so forgetting the scope is a compile error rather than a data leak.
 */
export class AccessScope {
  private constructor(
    readonly userId: string,
    readonly role: Role,
    readonly clientId?: string,
  ) {}

  /** Builds a scope from verified token claims. The only supported entry point. */
  static fromClaims(claims: JwtClaims): AccessScope {
    return new AccessScope(claims.sub, claims.role, claims.clientId);
  }

  /**
   * Escalated scope for trusted internal work with no acting user - seeding,
   * migrations, scheduled maintenance. Deliberately verbose to name at the
   * call site: it bypasses every filter below.
   */
  static systemScope(): AccessScope {
    return new AccessScope('system', Role.ADMINISTRATOR);
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
