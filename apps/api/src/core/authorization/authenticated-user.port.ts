import type { Role } from '@agencyflow/contracts';

/**
 * The authorisation facts about a user, read fresh from the database.
 *
 * Deliberately tiny: it carries what an authorisation decision needs and
 * nothing else. A name or an email in here would invite a controller to use
 * this as a general user lookup, and it would then be fetched on every single
 * request for the benefit of the few that wanted it.
 */
export interface AuthenticatedUserRecord {
  userId: string;
  role: Role;
  /** Present only for a Client Contact. The BR-10 anchor. */
  clientId?: string;
}

export const AUTHENTICATED_USER_LOOKUP = Symbol('AUTHENTICATED_USER_LOOKUP');

/**
 * Port through which the authentication layer re-reads the acting user.
 *
 * **Why a port rather than a direct dependency.** `AuthorizationModule` is a
 * core module, and core is depended upon but never depends
 * (`05-Software-Architecture.md` section 7, rule R1). Importing `UsersModule`
 * here would reverse that arrow and, worse, would put a feature module on the
 * critical path of every request in the system.
 *
 * So core declares the interface it needs and a feature satisfies it. The
 * dependency arrow still points inwards; only the implementation lives outside.
 */
export interface AuthenticatedUserLookup {
  /**
   * Returns the user only if they may currently authenticate — existing, not
   * soft-deleted, and `isActive`. Every other case is `null`, because the
   * caller must not be able to tell a deactivated account from a deleted one
   * or from an id that never existed.
   */
  findActiveById(userId: string): Promise<AuthenticatedUserRecord | null>;
}
