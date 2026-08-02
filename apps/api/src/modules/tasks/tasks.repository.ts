import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  MilestoneStatus,
  TaskStatus,
  deadlineWindow,
  progressPercentage,
} from '@agencyflow/contracts';
import { Model, Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ScopedRepository } from '../../core/database/scoped.repository';
import { Task, type TaskDocument } from './schemas/task.schema';
import type { MilestoneProgress, TaskProgressLookup } from '../projects/task-progress.port';
import type {
  ProjectTaskRollup,
  TaskInsight,
  TaskInsightCriteria,
  TaskInsightsLookup,
  WorkloadRow,
} from '../dashboards/task-insights.port';

/** Statuses that leave a task open for BR-32 and FR-034. */
const OPEN_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
];

/**
 * Sort position for a task with no due date: the end of representable time.
 *
 * A sentinel rather than a second sort stage, because "no deadline" genuinely
 * means "less urgent than any deadline", and saying so once in the pipeline is
 * clearer than a `$facet` that concatenates two sorted lists.
 */
const NO_DUE_DATE_SORT_KEY = new Date(8640000000000000);

interface MilestoneRollup {
  _id: Types.ObjectId;
  total: number;
  done: number;
  untouched: number;
}

/** The projected shape of a dashboard row, before it becomes a `TaskInsight`. */
interface TaskInsightRow {
  _id: Types.ObjectId;
  title: string;
  status: TaskStatus;
  projectId: Types.ObjectId;
  assigneeId: Types.ObjectId;
  dueDate?: Date;
  blockedReason?: string | null;
}

@Injectable()
export class TasksRepository
  extends ScopedRepository<TaskDocument>
  implements TaskProgressLookup, TaskInsightsLookup
{
  constructor(@InjectModel(Task.name) model: Model<TaskDocument>) {
    super(model);
  }

  /**
   * A task is visible exactly when its project is (BR-26, BR-28).
   *
   * Tasks carry no `clientId`, so visibility is entirely derivative: the
   * question "may this person see this task" is the question "may they see its
   * project", already answered by `AccessScope.projectScopeFilter()`.
   *
   * Three cases, and the third is the one that matters:
   *
   *   Administrator   no restriction
   *   Client Contact  NOTHING — clients never see tasks at all (BR-28)
   *   PM / Team Member  the projects resolved onto the scope
   *
   * **Unresolved fails closed.** `accessibleProjectIds` is `undefined` until
   * `TasksService` resolves it. Treating that as "no restriction" would expose
   * every task in the agency the first time someone forgot to resolve, so it
   * matches nothing instead. A missing list is a bug that shows up as an empty
   * page; the alternative shows up as a breach.
   */
  protected scopeFilter(scope: AccessScope): FilterQuery<TaskDocument> {
    if (scope.isAdministrator()) {
      return {};
    }

    if (scope.isClientContact()) {
      return { _id: null };
    }

    const projectIds = scope.accessibleProjectIds;

    if (!projectIds) {
      return { _id: null };
    }

    return { projectId: { $in: projectIds.map((id) => new Types.ObjectId(id)) } };
  }

  /**
   * FR-031, FR-032 — every milestone of one project, in a single aggregation.
   *
   * The formula is `06-Database-Design.md` §7.3 verbatim:
   *
   *   progress = done / (total excluding CANCELLED) x 100,  0 when denominator is 0
   *   status   = COMPLETED   all non-cancelled tasks DONE and count > 0
   *              NOT_STARTED no non-cancelled task has left TODO
   *              IN_PROGRESS otherwise
   *
   * `CANCELLED` is excluded from BOTH numerator and denominator (BR-12), which
   * is the part that is easy to get wrong: cancelling the last outstanding
   * task must complete the milestone, not stall it at 50%.
   *
   * No scope parameter, and that is not an oversight. This aggregates one
   * project's own tasks to describe that project, and the caller has already
   * proved it may see the project — `ProjectsService` only calls this for a
   * document its own scoped read returned. Requiring a task-level scope here
   * would make a Client Contact's milestone progress read as 0%, since clients
   * may see no tasks (BR-28) but may absolutely see progress (FR-033).
   */
  async progressByMilestone(projectId: Types.ObjectId): Promise<Map<string, MilestoneProgress>> {
    const rollups = await this.model
      .aggregate<MilestoneRollup>([
        {
          $match: {
            projectId,
            deletedAt: null,
            status: { $ne: TaskStatus.CANCELLED },
          },
        },
        {
          $group: {
            _id: '$milestoneId',
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $eq: ['$status', TaskStatus.DONE] }, 1, 0] } },
            untouched: { $sum: { $cond: [{ $eq: ['$status', TaskStatus.TODO] }, 1, 0] } },
          },
        },
      ])
      .exec();

    return new Map(rollups.map((rollup) => [rollup._id.toString(), this.toProgress(rollup)]));
  }

  private toProgress(rollup: MilestoneRollup): MilestoneProgress {
    const { total, done, untouched } = rollup;

    const progress = progressPercentage(done, total);

    let status: MilestoneStatus;

    if (total > 0 && done === total) {
      status = MilestoneStatus.COMPLETED;
    } else if (untouched === total) {
      status = MilestoneStatus.NOT_STARTED;
    } else {
      status = MilestoneStatus.IN_PROGRESS;
    }

    return { status, progress, openTaskCount: total - done };
  }

  /**
   * BR-32 — the tasks blocking a user's deactivation.
   *
   * Unscoped, like the authentication lookups: this answers a question about
   * the SYSTEM's integrity, not about what the asking Administrator can see.
   * Scoping it could let a deactivation succeed because the asker happened not
   * to see the blocking tasks, which is precisely the failure BR-32 exists to
   * prevent.
   */
  async findOpenTasksForAssignee(userId: Types.ObjectId): Promise<TaskDocument[]> {
    return this.model
      .find({ assigneeId: userId, status: { $in: OPEN_STATUSES }, deletedAt: null })
      .select('_id title projectId')
      .exec();
  }

  /** FR-034 — a milestone with open tasks cannot be deleted. */
  async countOpenTasksInMilestone(milestoneId: Types.ObjectId): Promise<number> {
    return this.model
      .countDocuments({ milestoneId, status: { $in: OPEN_STATUSES }, deletedAt: null })
      .exec();
  }

  /** BR-23 — every task currently assigned to someone within one project. */
  async countOpenTasksForMember(
    projectId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<number> {
    return this.model
      .countDocuments({
        projectId,
        assigneeId: userId,
        status: { $in: OPEN_STATUSES },
        deletedAt: null,
      })
      .exec();
  }

  // ---------------------------------------------------------------------
  // Dashboards — `TaskInsightsLookup` (FR-068 – FR-072)
  //
  // These live here, next to `scopeFilter`, rather than in the read model.
  // Cross-project reads are precisely where a scope mistake is invisible: a
  // project-nested query that lost its filter returns the wrong project's
  // tasks and someone notices, while an agency-wide one just looks busy.
  // ---------------------------------------------------------------------

  /** FR-068 – FR-072 — one capped list and its true total, both scoped. */
  async findTasks(
    criteria: TaskInsightCriteria,
    scope: AccessScope,
    now: Date,
  ): Promise<{ items: TaskInsight[]; total: number }> {
    const filter = this.insightFilter(criteria, now);

    const [rows, total] = await Promise.all([
      this.model
        .aggregate<TaskInsightRow>([
          { $match: this.buildFilter(scope, filter) },
          // Urgency order, and the reason this is an aggregation rather than a
          // `find().sort()`. MongoDB sorts missing values FIRST ascending, so
          // `{ dueDate: 1 }` would head a list called "most urgent" with every
          // task that has no deadline at all. The sentinel pushes them last.
          // Seeded data where everything has a due date would never show it.
          { $addFields: { dueSortKey: { $ifNull: ['$dueDate', NO_DUE_DATE_SORT_KEY] } } },
          { $sort: { dueSortKey: 1, createdAt: 1 } },
          { $limit: criteria.limit },
          {
            $project: {
              title: 1,
              status: 1,
              projectId: 1,
              assigneeId: 1,
              dueDate: 1,
              blockedReason: 1,
            },
          },
        ])
        .exec(),
      this.model.countDocuments(this.buildFilter(scope, filter)).exec(),
    ]);

    return { items: rows.map((row) => this.toInsight(row)), total };
  }

  /** FR-068 — open and overdue counts per assignee, in one pass. */
  async workloadByAssignee(scope: AccessScope, now: Date, limit: number): Promise<WorkloadRow[]> {
    const { overdueBefore } = deadlineWindow(now);

    const rows = await this.model
      .aggregate<{ _id: Types.ObjectId; openTaskCount: number; overdueTaskCount: number }>([
        { $match: this.buildFilter(scope, { status: { $in: OPEN_STATUSES } }) },
        {
          $group: {
            _id: '$assigneeId',
            openTaskCount: { $sum: 1 },
            overdueTaskCount: {
              $sum: {
                $cond: [
                  {
                    // The null check is NOT redundant. Query `$lt` never
                    // matches a missing field, but the AGGREGATION `$lt` is a
                    // total ordering in which `null` sorts BELOW every date —
                    // so without this, every task with no deadline would be
                    // counted as overdue. Same operator name, opposite
                    // behaviour, and only the aggregation one is wrong here.
                    $and: [{ $ne: ['$dueDate', null] }, { $lt: ['$dueDate', overdueBefore] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        // Busiest first: the panel exists to show who is overloaded, so the
        // person at the top is the answer to the question being asked.
        { $sort: { overdueTaskCount: -1, openTaskCount: -1 } },
        { $limit: limit },
      ])
      .exec();

    return rows.map((row) => ({
      assigneeId: row._id.toString(),
      openTaskCount: row.openTaskCount,
      overdueTaskCount: row.overdueTaskCount,
    }));
  }

  /**
   * Project-level rollups. Unscoped, for the same reason as
   * `progressByMilestone`: the caller supplies ids from its own scoped read,
   * and a Client Contact must see progress (FR-033) while seeing no tasks
   * (BR-28).
   */
  async progressByProject(projectIds: Types.ObjectId[]): Promise<Map<string, ProjectTaskRollup>> {
    if (projectIds.length === 0) {
      return new Map();
    }

    const rollups = await this.model
      .aggregate<{ _id: Types.ObjectId; total: number; done: number }>([
        {
          $match: {
            projectId: { $in: projectIds },
            deletedAt: null,
            // BR-12 — cancelled work leaves BOTH sides of the fraction.
            status: { $ne: TaskStatus.CANCELLED },
          },
        },
        {
          $group: {
            _id: '$projectId',
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $eq: ['$status', TaskStatus.DONE] }, 1, 0] } },
          },
        },
      ])
      .exec();

    return new Map(
      rollups.map((rollup) => [
        rollup._id.toString(),
        { total: rollup.total, done: rollup.done, open: rollup.total - rollup.done },
      ]),
    );
  }

  private insightFilter(criteria: TaskInsightCriteria, now: Date): FilterQuery<TaskDocument> {
    const filter: FilterQuery<TaskDocument> = { status: { $in: criteria.statuses } };

    if (criteria.assigneeId) {
      filter.assigneeId = new Types.ObjectId(criteria.assigneeId);
    }

    if (criteria.deadline) {
      const { overdueBefore, dueSoonBefore } = deadlineWindow(now);

      // A range comparison against a Date never matches a null or a missing
      // field (BSON type bracketing), so "has a due date" needs no clause of
      // its own — which is what keeps undated tasks out of both alert lists.
      filter.dueDate =
        criteria.deadline === 'OVERDUE'
          ? { $lt: overdueBefore }
          : { $gte: overdueBefore, $lt: dueSoonBefore };
    }

    return filter;
  }

  private toInsight(row: TaskInsightRow): TaskInsight {
    return {
      id: row._id.toString(),
      title: row.title,
      status: row.status,
      projectId: row.projectId.toString(),
      assigneeId: row.assigneeId.toString(),
      ...(row.dueDate ? { dueDate: row.dueDate } : {}),
      // Only while blocked. A stale reason on a task that has moved on is a
      // lie the dashboard would render in bold (BR-22).
      ...(row.status === TaskStatus.BLOCKED && row.blockedReason
        ? { blockedReason: row.blockedReason }
        : {}),
    };
  }
}
