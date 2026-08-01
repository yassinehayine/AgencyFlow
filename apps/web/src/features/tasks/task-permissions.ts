import { Role, TASK_STATUS_TRANSITIONS } from '@agencyflow/contracts';
import type { AuthenticatedUser, TaskStatus, TaskSummary } from '@agencyflow/contracts';

/**
 * Which task commands to OFFER. Never which are permitted.
 *
 * The API enforces BR-04, BR-22 and BR-26 independently (FR-039 is explicit
 * that the refusal is server-side), and deleting this file would change
 * nothing a user can do. It exists so the board does not show a Team Member a
 * "Terminer" button that always returns 403.
 *
 * Pure functions in their own module, so the rules can be tested without
 * rendering anything.
 */

/** The command behind each transition, mirroring the API's named endpoints. */
export type TaskCommand =
  'start' | 'submit-review' | 'done' | 'return' | 'block' | 'unblock' | 'cancel';

export interface TaskAction {
  command: TaskCommand;
  /** The status the task ends in — used only for the label. */
  target: TaskStatus;
}

const isManager = (user: AuthenticatedUser | null): boolean =>
  user?.role === Role.ADMINISTRATOR || user?.role === Role.PROJECT_MANAGER;

const isAssignee = (user: AuthenticatedUser | null, task: TaskSummary): boolean =>
  user?.id === task.assignee.id;

/**
 * BR-26 — a Team Member may modify only tasks assigned to them.
 *
 * Viewing is not restricted this way: FR-043 lets a Team Member see every task
 * of the projects they belong to. Only modification is narrowed.
 */
export function canModify(user: AuthenticatedUser | null, task: TaskSummary): boolean {
  if (!user) {
    return false;
  }

  return isManager(user) || isAssignee(user, task);
}

/**
 * BR-04 — the refusal this product is judged on.
 *
 * Separate from `canModify` on purpose. The assignee may modify their task in
 * every other way and still may not complete it, so folding completion into a
 * general "can modify" check is exactly how BR-04 would quietly become
 * advisory.
 */
export function canComplete(user: AuthenticatedUser | null): boolean {
  return isManager(user);
}

/**
 * The commands to render for one task.
 *
 * Two filters, applied in order, because they answer different questions:
 * `TASK_STATUS_TRANSITIONS` says where the task can GO (SRS §6.1), and the
 * role check says who may take it there. A transition that is reachable but
 * not permitted — `IN_REVIEW → DONE` for a Team Member — must not appear.
 */
export function availableCommands(user: AuthenticatedUser | null, task: TaskSummary): TaskAction[] {
  if (!canModify(user, task)) {
    return [];
  }

  const reachable = TASK_STATUS_TRANSITIONS[task.status];
  const manager = isManager(user);
  const actions: TaskAction[] = [];

  if (reachable.includes('IN_PROGRESS')) {
    // One target status, two different commands. From IN_REVIEW it is a
    // manager returning work; from anywhere else it is starting or resuming.
    if (task.status === 'IN_REVIEW') {
      if (manager) actions.push({ command: 'return', target: 'IN_PROGRESS' });
    } else if (task.status === 'BLOCKED') {
      actions.push({ command: 'unblock', target: 'TODO' });
    } else {
      actions.push({ command: 'start', target: 'IN_PROGRESS' });
    }
  }

  if (reachable.includes('IN_REVIEW')) {
    actions.push({ command: 'submit-review', target: 'IN_REVIEW' });
  }

  // BR-04. Reachable from IN_REVIEW, permitted only for a manager.
  if (reachable.includes('DONE') && canComplete(user)) {
    actions.push({ command: 'done', target: 'DONE' });
  }

  if (reachable.includes('BLOCKED')) {
    actions.push({ command: 'block', target: 'BLOCKED' });
  }

  // FR-042 — cancelling is a manager's decision, not the assignee's.
  if (reachable.includes('CANCELLED') && manager) {
    actions.push({ command: 'cancel', target: 'CANCELLED' });
  }

  return actions;
}
