/**
 * Task contracts (06-Database-Design.md section 7.4, SRS section 6.1).
 *
 * A Task has exactly one assignee (BR-03) who must already be on the project
 * team (BR-23), and only a Project Manager or Administrator may mark one
 * `DONE` (BR-04).
 */
import type { PaginationQuery } from './api.js';
import type { TaskStatus } from './enums.js';
import type { UserSummary } from './users.js';

export const TASK_LIMITS = {
  TITLE_MIN: 2,
  TITLE_MAX: 200,
  DESCRIPTION_MAX: 5000,
  BLOCKED_REASON_MIN: 3,
  BLOCKED_REASON_MAX: 500,
} as const;

/**
 * The permitted transitions (SRS §6.1).
 *
 * Published so the interface offers only the moves the server accepts. It is
 * NOT the authorisation rule: several of these transitions are additionally
 * restricted by WHO is asking — most importantly `IN_REVIEW → DONE`, which no
 * Team Member may perform however the table reads (BR-04). Reachability and
 * permission are two different questions, and conflating them is how BR-04
 * would quietly become advisory.
 */
export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  TODO: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'CANCELLED'],
  IN_REVIEW: ['DONE', 'IN_PROGRESS'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
} as const;

/** Statuses that leave a task outstanding (BR-12, BR-32, FR-034). */
export const OPEN_TASK_STATUSES: readonly TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
];

export interface TaskSummary {
  id: string;
  projectId: string;
  milestoneId: string;
  title: string;
  status: TaskStatus;
  assignee: UserSummary;
  dueDate?: string;
  /** Present only while `status` is `BLOCKED` (BR-22, CIR-6). */
  blockedReason?: string;
}

export interface TaskDetail extends TaskSummary {
  description?: string;
  blockedAt?: string;
  completedAt?: string;
  /** The Project Manager who approved completion — the BR-04 audit trail. */
  completedById?: string;
  createdAt: string;
  updatedAt: string;
}

/** FR-035. `status` is absent: a new task is always `TODO`. */
export interface CreateTaskRequest {
  title: string;
  description?: string;
  milestoneId: string;
  assigneeId: string;
  dueDate?: string;
}

/**
 * FR-037. `status` and `assigneeId` are absent.
 *
 * Status moves through named commands so BR-04 cannot be bypassed; assignment
 * is its own command (FR-036) because it carries the BR-23 membership check.
 */
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  dueDate?: string;
  milestoneId?: string;
}

/** FR-036 */
export interface AssignTaskRequest {
  assigneeId: string;
}

/** FR-041 — the reason is mandatory and must survive trimming (BR-22). */
export interface BlockTaskRequest {
  reason: string;
}

/** FR-043 */
export interface TaskListQuery extends PaginationQuery {
  projectId?: string;
  milestoneId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  search?: string;
}
