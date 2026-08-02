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
  /** SRS §6.4 — the requested status is not reachable from the current one. */
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  /** FR-019 — a project cannot end before it starts. */
  END_DATE_BEFORE_START_DATE: 'END_DATE_BEFORE_START_DATE',
  /** BR-24 — the owning PM must hold PROJECT_MANAGER or ADMINISTRATOR. */
  INVALID_PROJECT_MANAGER: 'INVALID_PROJECT_MANAGER',
  /** BR-23 — only an active user with role TEAM_MEMBER may join a team. */
  INVALID_TEAM_MEMBER: 'INVALID_TEAM_MEMBER',
  /** BR-23 — one membership per user per project. */
  ALREADY_TEAM_MEMBER: 'ALREADY_TEAM_MEMBER',
  /** P-9 — the embedded array is bounded, and that bound is what makes it safe. */
  TEAM_LIMIT_REACHED: 'TEAM_LIMIT_REACHED',
  MILESTONE_LIMIT_REACHED: 'MILESTONE_LIMIT_REACHED',
  /** 06-DB §7.3 — `order` is unique within a project's milestones. */
  MILESTONE_ORDER_TAKEN: 'MILESTONE_ORDER_TAKEN',
  /** BR-07 — an approved deliverable is final in every respect. */
  DELIVERABLE_ALREADY_APPROVED: 'DELIVERABLE_ALREADY_APPROVED',
  /** FR-047, BR-05 — a submission with nothing attached asks for nothing. */
  SUBMISSION_REQUIRES_FILE: 'SUBMISSION_REQUIRES_FILE',
  /** FR-049 — a change request must say what to change. */
  DECISION_COMMENT_REQUIRED: 'DECISION_COMMENT_REQUIRED',
  /** P-9 — the embedded version array is bounded. */
  VERSION_LIMIT_REACHED: 'VERSION_LIMIT_REACHED',
  /** BR-15, NFR-24 — type, content or size refused server-side. */
  FILE_REJECTED: 'FILE_REJECTED',
  /** P-9 — a version carries at most 20 files. */
  FILE_LIMIT_REACHED: 'FILE_LIMIT_REACHED',

  /** FR-027 — an archived project is read-only. */
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
  /** BR-04 — only a Project Manager or Administrator may complete a task. */
  TASK_COMPLETION_FORBIDDEN: 'TASK_COMPLETION_FORBIDDEN',
  /** BR-26 — a Team Member may modify only tasks assigned to them. */
  TASK_NOT_ASSIGNED_TO_YOU: 'TASK_NOT_ASSIGNED_TO_YOU',
  /** BR-22, CIR-6 — a blocked task must carry a non-empty reason. */
  BLOCKED_REASON_REQUIRED: 'BLOCKED_REASON_REQUIRED',
  /** BR-23 — the assignee must already be on the project team. */
  ASSIGNEE_NOT_ON_TEAM: 'ASSIGNEE_NOT_ON_TEAM',
  /** 06-DB §9 — the milestone must belong to the task's project. */
  MILESTONE_NOT_IN_PROJECT: 'MILESTONE_NOT_IN_PROJECT',
  /** FR-034 — a milestone with outstanding tasks cannot be deleted. */
  MILESTONE_HAS_OPEN_TASKS: 'MILESTONE_HAS_OPEN_TASKS',
  /** FR-024 — a member with outstanding tasks cannot be removed from a team. */
  MEMBER_HAS_OPEN_TASKS: 'MEMBER_HAS_OPEN_TASKS',

  // --- 500 -----------------------------------------------------------------
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
