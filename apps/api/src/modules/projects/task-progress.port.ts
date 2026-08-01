import type { MilestoneStatus } from '@agencyflow/contracts';
import type { Types } from 'mongoose';

/**
 * One milestone's computed roll-up (BR-08, BR-12, SRS §6.3).
 *
 * Never persisted. `06-Database-Design.md` §7.3 is explicit that
 * `milestones[]` carries no `status` and no `progress` field, because a stored
 * copy can disagree with the tasks it summarises and the disagreement is
 * silent — no error, just a wrong percentage shown to a client deciding
 * whether to approve work.
 */
export interface MilestoneProgress {
  status: MilestoneStatus;
  /** 0–100, integer. Zero when the milestone has no non-cancelled tasks. */
  progress: number;
  /** Non-cancelled task count — the denominator, exposed for FR-034. */
  openTaskCount: number;
}

export const TASK_PROGRESS_LOOKUP = Symbol('TASK_PROGRESS_LOOKUP');

/**
 * Port through which `ProjectsModule` reads task-derived facts.
 *
 * **Why a port.** `08-Backend-Design.md` §1.3 makes `ProjectsModule` the sole
 * writer of the project document, and milestones are embedded in it — which is
 * why there is no `MilestonesModule`. But milestone progress is computed from
 * `tasks`, and `TasksModule` already depends on `ProjectsModule`. Importing it
 * back would close `Projects → Tasks → Projects`, which architecture rule R2
 * forbids.
 *
 * So `ProjectsModule` declares what it needs and `TasksModule` satisfies it,
 * exactly as `AuthorizationModule` does for the authenticated-user lookup
 * (ADR-0005). The dependency arrow keeps pointing one way; only the
 * implementation lives on the other side.
 */
export interface TaskProgressLookup {
  /**
   * Rolls up every milestone of one project in a SINGLE aggregation.
   *
   * Keyed by milestone id as a string. A milestone with no tasks is absent
   * from the map rather than zero-filled, so the caller decides what "no
   * tasks yet" should read as — and cannot mistake absence for a real zero.
   *
   * One call per project, not one per milestone: a project detail view shows
   * every milestone at once, and per-milestone queries would make the page
   * cost grow with the roadmap.
   */
  progressByMilestone(projectId: Types.ObjectId): Promise<Map<string, MilestoneProgress>>;

  /**
   * FR-024 — how much outstanding work a member still holds on one project.
   *
   * Removing someone who still owns open tasks would orphan them: the task
   * keeps an `assigneeId` pointing at a person no longer permitted to touch
   * it, and BR-23 says an assignee must be on the team. Refusing the removal
   * keeps that invariant true rather than repairing it afterwards.
   */
  countOpenTasksForMember(projectId: Types.ObjectId, userId: Types.ObjectId): Promise<number>;
}
