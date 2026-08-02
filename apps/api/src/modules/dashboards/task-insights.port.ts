import type { TaskStatus } from '@agencyflow/contracts';
import type { Types } from 'mongoose';

import type { AccessScope } from '../../core/authorization/access-scope';

/**
 * The questions the dashboards may ask about tasks.
 *
 * Declared by the CONSUMER, as with `TASK_PROGRESS_LOOKUP` and
 * `OPEN_TASKS_LOOKUP` — but for a different reason, and the difference is
 * worth stating because it changes what the port is protecting.
 *
 * Those two exist to break a dependency cycle. This one does not: nothing in
 * `TasksModule` knows dashboards exist, so a plain import would compile. It
 * exists because `TasksModule` deliberately exports neither its service nor
 * its repository, and a read model that acquired an unrestricted handle on the
 * task collection would be free to invent its own scope filter. Three named
 * questions is a boundary that can be reviewed; `TasksRepository` is not.
 *
 * Every method takes a scope that has already been resolved with
 * `accessibleProjectIds`. Passing a raw one is not a leak — `TasksRepository`
 * fails closed on an unresolved scope — but it is an empty dashboard, so the
 * service resolves once per request and passes the result down.
 */
export const TASK_INSIGHTS_LOOKUP = Symbol('TASK_INSIGHTS_LOOKUP');

/**
 * A dashboard task, already flattened. Not `TaskDocument`: the port hands back
 * the fields a dashboard displays and nothing else, so the read model has no
 * document to accidentally mutate and no field to accidentally expose.
 */
export interface TaskInsight {
  id: string;
  title: string;
  status: TaskStatus;
  projectId: string;
  assigneeId: string;
  dueDate?: Date;
  blockedReason?: string;
}

/**
 * `DUE_SOON` and `OVERDUE` are the FR-072 window, applied as a date range.
 * Naming them here rather than accepting two `Date`s keeps the boundary
 * arithmetic in one place — `deadlineWindow()` — instead of at every caller.
 */
export type DeadlineFilter = 'OVERDUE' | 'DUE_SOON';

export interface TaskInsightCriteria {
  statuses: readonly TaskStatus[];
  /** Restricts to one person's work — the Team Member's own board (BR-26). */
  assigneeId?: string;
  deadline?: DeadlineFilter;
  limit: number;
}

/** One person's outstanding work, for FR-068's workload panel. */
export interface WorkloadRow {
  assigneeId: string;
  openTaskCount: number;
  overdueTaskCount: number;
}

/** Task totals for one project, for the headline percentage (BR-12). */
export interface ProjectTaskRollup {
  total: number;
  done: number;
  open: number;
}

export interface TaskInsightsLookup {
  /**
   * A capped list plus the true total. Both are scoped, so the count can never
   * describe more rows than the list was allowed to draw from.
   */
  findTasks(
    criteria: TaskInsightCriteria,
    scope: AccessScope,
    now: Date,
  ): Promise<{ items: TaskInsight[]; total: number }>;

  /** FR-068 — open and overdue counts per assignee, in one aggregation. */
  workloadByAssignee(scope: AccessScope, now: Date, limit: number): Promise<WorkloadRow[]>;

  /**
   * Task rollups for the given projects, UNSCOPED by design.
   *
   * The caller has already proved it may see these projects — the ids come
   * from its own scoped read. Scoping again here would report 0% to every
   * Client Contact, who may see no tasks at all (BR-28) but must absolutely
   * see progress (FR-033, US-059). The same reasoning as `progressByMilestone`.
   */
  progressByProject(projectIds: Types.ObjectId[]): Promise<Map<string, ProjectTaskRollup>>;
}
