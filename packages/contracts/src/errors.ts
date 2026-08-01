/**
 * Stable, machine-readable error codes (08-Backend-Design.md section 5).
 *
 * The API returns both a `code` and a French `message`. The code is the
 * contract: the web client branches on it, and it never changes. The message
 * is for display and may be reworded freely — which is only safe because no
 * client is ever allowed to parse it (NFR-01).
 *
 * Grouped by the HTTP status they map to, because the grouping is the part
 * that is easy to get wrong: a uniqueness clash is a 409, a rule violation on
 * a well-formed request is a 422, and the difference matters to the client.
 */
export const ErrorCode = {
  // --- 400 · malformed request --------------------------------------------
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // --- 401 · not authenticated --------------------------------------------
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /**
   * Deliberately covers a wrong password, an unknown address AND a
   * deactivated account. Distinguishing them would confirm which addresses
   * are registered (FR-001).
   */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // --- 403 · authenticated but not permitted ------------------------------
  FORBIDDEN: 'FORBIDDEN',

  /**
   * 404 · not found OR out of scope — the two are indistinguishable on
   * purpose. A 403 would confirm the resource exists, which is itself a
   * disclosure (BR-10, 05-Software-Architecture.md section 10.5).
   */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // --- 409 · uniqueness and state conflicts -------------------------------
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS: 'USERNAME_ALREADY_EXISTS',
  CLIENT_NAME_ALREADY_EXISTS: 'CLIENT_NAME_ALREADY_EXISTS',

  // --- 422 · well-formed request that a business rule refuses -------------
  /** BR-33, A-13 — the username is the mention handle and cannot be reused. */
  USERNAME_IMMUTABLE: 'USERNAME_IMMUTABLE',
  /** CIR-1 — a Team Member must carry a skill. */
  SKILL_REQUIRED: 'SKILL_REQUIRED',
  /** CIR-1 — no other role may carry one. */
  SKILL_NOT_APPLICABLE: 'SKILL_NOT_APPLICABLE',
  /** CIR-2 — a Client Contact must belong to exactly one organisation. */
  CLIENT_REQUIRED: 'CLIENT_REQUIRED',
  /** CIR-2 — an internal role must not. */
  CLIENT_NOT_APPLICABLE: 'CLIENT_NOT_APPLICABLE',
  /** A-10 — the system must retain at least one active Administrator. */
  LAST_ACTIVE_ADMINISTRATOR: 'LAST_ACTIVE_ADMINISTRATOR',
  /** BR-32 — reassign or cancel the open tasks first. */
  USER_HAS_OPEN_TASKS: 'USER_HAS_OPEN_TASKS',
  /** FR-005 — the current password did not match. */
  CURRENT_PASSWORD_INCORRECT: 'CURRENT_PASSWORD_INCORRECT',
  /** ADR-0004 section 6 — an archived organisation accepts no new work. */
  CLIENT_ARCHIVED: 'CLIENT_ARCHIVED',

  // --- 500 -----------------------------------------------------------------
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
