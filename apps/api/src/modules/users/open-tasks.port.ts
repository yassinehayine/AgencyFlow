import type { OpenTaskReference } from '@agencyflow/contracts';
import type { Types } from 'mongoose';

export const OPEN_TASKS_LOOKUP = Symbol('OPEN_TASKS_LOOKUP');

/**
 * Port through which `UsersModule` checks BR-32 before a deactivation.
 *
 * **This is the dependency that deferred US-008 out of Slice 2.** BR-32 refuses
 * to deactivate a user while they hold tasks that are neither `DONE` nor
 * `CANCELLED`, and `tasks` did not exist then. It could not be resolved by
 * importing `TasksModule` either: that closes
 * `Users → Tasks → Projects → Users`.
 *
 * Inverting it is what makes the rule enforceable without bending the module
 * graph — `UsersModule` states the question, `TasksModule` answers it.
 */
export interface OpenTasksLookup {
  /**
   * The tasks blocking this user's deactivation, with enough context to act on.
   *
   * Returning the list rather than a count is the point: BR-32 turns a dead
   * end into a next step only if the Administrator can see WHICH tasks to
   * reassign (FR-010, US-008).
   */
  findOpenTasksForAssignee(userId: Types.ObjectId): Promise<OpenTaskReference[]>;
}
