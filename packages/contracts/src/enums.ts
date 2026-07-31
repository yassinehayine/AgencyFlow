/**
 * Domain enumerations, frozen in 06-Database-Design.md section 6.
 *
 * Declared as `as const` objects rather than TypeScript `enum` declarations:
 * the object form is erasable, tree-shakeable, and works directly with both
 * class-validator (`@IsEnum(Role)`) and Mongoose (`enum: Object.values(Role)`).
 *
 * Values are uppercase strings, not integers. Strings cost a few bytes and
 * make every document self-describing in the shell, in logs and in Compass.
 */

/** Who a user is. Permissions derive from role only (BR-02). */
export const Role = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  TEAM_MEMBER: 'TEAM_MEMBER',
  CLIENT_CONTACT: 'CLIENT_CONTACT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * A Team Member's specialization. Descriptive data only — a skill never
 * grants a permission (BR-02). Fixed list in v1 (A-01, OQ-12 closed).
 */
export const Skill = {
  BACKEND: 'BACKEND',
  FRONTEND: 'FRONTEND',
  UI_UX: 'UI_UX',
  GRAPHIC_DESIGN: 'GRAPHIC_DESIGN',
  QA: 'QA',
} as const;
export type Skill = (typeof Skill)[keyof typeof Skill];

/** Project lifecycle. Set manually by the owning PM or an Administrator. */
export const ProjectStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/**
 * Milestone lifecycle. COMPUTED from tasks and never stored (BR-08).
 * No milestone document carries this value; it is derived on read.
 */
export const MilestoneStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

/** Task lifecycle. Only a PM or Administrator may reach DONE (BR-04). */
export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/**
 * Deliverable lifecycle. APPROVED is terminal and immutable (BR-07).
 * UNDER_REVIEW is entered only by the explicit start-review command
 * (FR-081, BR-31) and may be bypassed entirely (A-14).
 */
export const DeliverableStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
} as const;
export type DeliverableStatus = (typeof DeliverableStatus)[keyof typeof DeliverableStatus];

/** The client's decision on one deliverable version. */
export const VersionOutcome = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
} as const;
export type VersionOutcome = (typeof VersionOutcome)[keyof typeof VersionOutcome];

/**
 * What a comment is attached to. Visibility is DERIVED from this value,
 * never stored: TASK comments are internal, DELIVERABLE comments are
 * client-visible (BR-14).
 */
export const CommentTargetType = {
  TASK: 'TASK',
  DELIVERABLE: 'DELIVERABLE',
} as const;
export type CommentTargetType = (typeof CommentTargetType)[keyof typeof CommentTargetType];

/** Whether a Client Contact may see an activity (BR-21). */
export const ActivityVisibility = {
  CLIENT_VISIBLE: 'CLIENT_VISIBLE',
  INTERNAL: 'INTERNAL',
} as const;
export type ActivityVisibility = (typeof ActivityVisibility)[keyof typeof ActivityVisibility];

/**
 * Business events recorded in the activity feed. Visibility is derived
 * from the type by the writing code and is never client-supplied (BR-21).
 */
export const ActivityType = {
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_STATUS_CHANGED: 'PROJECT_STATUS_CHANGED',
  MILESTONE_COMPLETED: 'MILESTONE_COMPLETED',
  DELIVERABLE_SUBMITTED: 'DELIVERABLE_SUBMITTED',
  DELIVERABLE_APPROVED: 'DELIVERABLE_APPROVED',
  DELIVERABLE_CHANGES_REQUESTED: 'DELIVERABLE_CHANGES_REQUESTED',
  DELIVERABLE_COMMENTED: 'DELIVERABLE_COMMENTED',
  DELIVERABLE_FILE_UPLOADED: 'DELIVERABLE_FILE_UPLOADED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_COMMENTED: 'TASK_COMMENTED',
  TASK_ATTACHMENT_UPLOADED: 'TASK_ATTACHMENT_UPLOADED',
  PROJECT_FILE_UPLOADED: 'PROJECT_FILE_UPLOADED',
  TEAM_MEMBER_ADDED: 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED: 'TEAM_MEMBER_REMOVED',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

/**
 * In-app notification triggers (FR-064). In-app only in v1 (BR-17).
 * Due-soon and overdue alerts are absent by design: they are computed on
 * read and never stored (BR-20).
 */
export const NotificationType = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  DELIVERABLE_SUBMITTED: 'DELIVERABLE_SUBMITTED',
  DELIVERABLE_APPROVED: 'DELIVERABLE_APPROVED',
  DELIVERABLE_CHANGES_REQUESTED: 'DELIVERABLE_CHANGES_REQUESTED',
  COMMENT_CREATED: 'COMMENT_CREATED',
  USER_MENTIONED: 'USER_MENTIONED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Roles that belong to the agency rather than to a client organization. */
export const INTERNAL_ROLES: readonly Role[] = [
  Role.ADMINISTRATOR,
  Role.PROJECT_MANAGER,
  Role.TEAM_MEMBER,
];

/** Task statuses excluded from milestone progress calculation (BR-12). */
export const PROGRESS_EXCLUDED_TASK_STATUSES: readonly TaskStatus[] = [TaskStatus.CANCELLED];
