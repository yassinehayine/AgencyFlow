import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MilestoneStatus, TaskStatus } from '@agencyflow/contracts';
import { Model, Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ScopedRepository } from '../../core/database/scoped.repository';
import { Task, type TaskDocument } from './schemas/task.schema';
import type { MilestoneProgress, TaskProgressLookup } from '../projects/task-progress.port';

/** Statuses that leave a task open for BR-32 and FR-034. */
const OPEN_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
];

interface MilestoneRollup {
  _id: Types.ObjectId;
  total: number;
  done: number;
  untouched: number;
}

@Injectable()
export class TasksRepository extends ScopedRepository<TaskDocument> implements TaskProgressLookup {
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

    const progress = this.percentage(done, total);

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
   * Rounds, then clamps at both ends.
   *
   * Rounding alone is wrong where it matters most: 199 of 200 tasks is 99.5%,
   * which `Math.round` turns into **100%** — a milestone reported as finished
   * while work remains, shown to a client who is deciding whether to approve
   * it. The clamp costs half a percentage point of precision and buys the
   * guarantee that 100 means done.
   *
   * The lower clamp is the same argument, less severe: 1 of 200 rounds to 0,
   * and "0%" on a milestone somebody has already worked on reads as nothing
   * having happened.
   */
  private percentage(done: number, total: number): number {
    if (total === 0) {
      return 0;
    }

    const rounded = Math.round((done / total) * 100);

    if (rounded === 100 && done < total) {
      return 99;
    }

    if (rounded === 0 && done > 0) {
      return 1;
    }

    return rounded;
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
}
