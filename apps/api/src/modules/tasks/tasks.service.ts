import { Injectable } from '@nestjs/common';
import { ErrorCode, TASK_STATUS_TRANSITIONS, TaskStatus } from '@agencyflow/contracts';
import type { PaginatedResponse, TaskDetail, TaskSummary } from '@agencyflow/contracts';
import { Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  AccessDeniedException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '../../common/exceptions/domain.exception';
import { fr } from '../../i18n/fr';
import { ProjectsRepository } from '../projects/projects.repository';
import { UsersRepository } from '../users/users.repository';
import { toUserSummary } from '../users/users.mapper';
import { TasksRepository } from './tasks.repository';
import type { ProjectDocument } from '../projects/schemas/project.schema';
import type { TaskDocument } from './schemas/task.schema';
import type {
  AssignTaskDto,
  BlockTaskDto,
  CreateTaskDto,
  TaskListQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';

/**
 * Task business rules (FR-035 – FR-043).
 *
 * This service holds the rules the whole product is judged on. BR-04 in
 * particular — a Team Member may never mark a task `Done` — is the reason
 * every transition is a named command rather than a writable `status` field:
 * there is no generic path to bypass.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly projects: ProjectsRepository,
    private readonly users: UsersRepository,
  ) {}

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  /** FR-043 */
  async findAll(
    query: TaskListQueryDto,
    rawScope: AccessScope,
  ): Promise<PaginatedResponse<TaskSummary>> {
    const scope = await this.resolveScope(rawScope);
    const filter = this.buildListFilter(query);

    const [documents, totalItems] = await Promise.all([
      this.repository.findMany(filter, scope, {
        skip: query.skip,
        limit: query.pageSize,
        sort: { [this.sortField(query.sortBy)]: query.sortOrder === 'desc' ? -1 : 1 },
      }),
      this.repository.count(filter, scope),
    ]);

    return paginate(await this.toSummaries(documents, scope), totalItems, query);
  }

  async findById(id: string, rawScope: AccessScope): Promise<TaskDetail> {
    const scope = await this.resolveScope(rawScope);
    const task = await this.getOrFail(id, scope);

    return this.toDetail(task, scope);
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  /** FR-035 — PM/Admin only; a new task is always `TODO`. */
  async create(projectId: string, dto: CreateTaskDto, rawScope: AccessScope): Promise<TaskDetail> {
    const scope = await this.resolveScope(rawScope);
    const project = await this.getProjectForWrite(projectId, scope);

    this.assertMilestoneBelongsToProject(project, dto.milestoneId);
    this.assertOnTeam(project, dto.assigneeId);

    const created = await this.repository.create(
      {
        projectId: project._id,
        milestoneId: new Types.ObjectId(dto.milestoneId),
        title: dto.title,
        ...(dto.description ? { description: dto.description } : {}),
        assigneeId: new Types.ObjectId(dto.assigneeId),
        status: TaskStatus.TODO,
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
      },
      scope,
    );

    return this.toDetail(created, scope);
  }

  /** FR-037 — PM/Admin only. Neither status nor assignee is reachable here. */
  async update(id: string, dto: UpdateTaskDto, rawScope: AccessScope): Promise<TaskDetail> {
    const scope = await this.resolveScope(rawScope);
    const task = await this.getOrFail(id, scope);
    const project = await this.getProjectForWrite(task.projectId.toString(), scope);

    if (dto.milestoneId) {
      this.assertMilestoneBelongsToProject(project, dto.milestoneId);
    }

    const updated = await this.repository.updateById(
      id,
      {
        $set: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
          ...(dto.milestoneId ? { milestoneId: new Types.ObjectId(dto.milestoneId) } : {}),
        },
      },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  /** FR-036 — BR-23: the assignee must already be on the project team. */
  async assign(id: string, dto: AssignTaskDto, rawScope: AccessScope): Promise<TaskDetail> {
    const scope = await this.resolveScope(rawScope);
    const task = await this.getOrFail(id, scope);
    const project = await this.getProjectForWrite(task.projectId.toString(), scope);

    this.assertOnTeam(project, dto.assigneeId);

    const updated = await this.repository.updateById(
      id,
      { $set: { assigneeId: new Types.ObjectId(dto.assigneeId) } },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  // ---------------------------------------------------------------------
  // Commands — the state machine (SRS §6.1)
  // ---------------------------------------------------------------------

  /** FR-038 — the assignee starts their own task. */
  async start(id: string, scope: AccessScope): Promise<TaskDetail> {
    return this.transition(id, TaskStatus.IN_PROGRESS, scope, { assigneeOrManager: true });
  }

  /** FR-038 — the assignee submits it for review. */
  async submitForReview(id: string, scope: AccessScope): Promise<TaskDetail> {
    return this.transition(id, TaskStatus.IN_REVIEW, scope, { assigneeOrManager: true });
  }

  /**
   * FR-039, FR-040 — BR-04.
   *
   * The single most important refusal in the product. A Team Member cannot
   * mark their own work complete, however the interface is manipulated: the
   * check is here, in the service, not in a guard that a future route could
   * forget and not in the UI where it is only cosmetic.
   */
  async markDone(id: string, scope: AccessScope): Promise<TaskDetail> {
    if (!scope.isAdministrator() && !scope.isProjectManager()) {
      throw new AccessDeniedException(fr.tasks.completionForbidden);
    }

    return this.transition(id, TaskStatus.DONE, scope, { managerOnly: true });
  }

  /** FR-040 — a manager returns work to the assignee. */
  async returnToProgress(id: string, scope: AccessScope): Promise<TaskDetail> {
    return this.transition(id, TaskStatus.IN_PROGRESS, scope, {
      managerOnly: true,
      from: [TaskStatus.IN_REVIEW],
    });
  }

  /** FR-041 — BR-22: the reason is mandatory and must survive trimming. */
  async block(id: string, dto: BlockTaskDto, scope: AccessScope): Promise<TaskDetail> {
    const reason = dto.reason.trim();

    // The DTO already rejects an empty string, but whitespace-only survives a
    // `@MinLength` check and would produce a blocked task whose reason renders
    // as nothing (CIR-6). Trimming here is what makes the stored value honest.
    if (reason.length === 0) {
      throw new BusinessRuleViolationException(
        ErrorCode.BLOCKED_REASON_REQUIRED,
        fr.tasks.blockedReasonRequired,
      );
    }

    return this.transition(id, TaskStatus.BLOCKED, scope, {
      assigneeOrManager: true,
      extra: { blockedReason: reason, blockedAt: new Date() },
    });
  }

  /**
   * FR-041 — clearing `BLOCKED`.
   *
   * BR-22 requires the blocked fields to be cleared, not merely ignored: a
   * stale reason on an unblocked task is a lie the interface would faithfully
   * display.
   */
  async unblock(id: string, scope: AccessScope): Promise<TaskDetail> {
    return this.transition(id, TaskStatus.TODO, scope, {
      assigneeOrManager: true,
      from: [TaskStatus.BLOCKED],
      clearBlocked: true,
    });
  }

  /** FR-042 — cancelled tasks leave milestone progress entirely (BR-12). */
  async cancel(id: string, scope: AccessScope): Promise<TaskDetail> {
    return this.transition(id, TaskStatus.CANCELLED, scope, { managerOnly: true });
  }

  // ---------------------------------------------------------------------
  // The one place a status is written
  // ---------------------------------------------------------------------

  private async transition(
    id: string,
    next: TaskStatus,
    rawScope: AccessScope,
    rules: {
      managerOnly?: boolean;
      assigneeOrManager?: boolean;
      from?: TaskStatus[];
      clearBlocked?: boolean;
      extra?: Record<string, unknown>;
    },
  ): Promise<TaskDetail> {
    const scope = await this.resolveScope(rawScope);
    const task = await this.getOrFail(id, scope);
    const isManager = scope.isAdministrator() || scope.isProjectManager();

    if (rules.managerOnly && !isManager) {
      throw new AccessDeniedException(fr.tasks.managerOnly);
    }

    // BR-26 — a Team Member may modify only tasks assigned to them. Viewing
    // every task of their projects is fine; changing someone else's is not.
    if (rules.assigneeOrManager && !isManager && task.assigneeId.toString() !== scope.userId) {
      throw new AccessDeniedException(fr.tasks.notAssignedToYou);
    }

    if (rules.from && !rules.from.includes(task.status)) {
      throw new BusinessRuleViolationException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        fr.tasks.invalidTransition(task.status, next),
      );
    }

    if (!TASK_STATUS_TRANSITIONS[task.status].includes(next)) {
      throw new BusinessRuleViolationException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        fr.tasks.invalidTransition(task.status, next),
      );
    }

    const updated = await this.repository.updateById(
      id,
      {
        $set: {
          status: next,
          ...(rules.extra ?? {}),
          // The BR-04 audit trail: who approved, and when.
          ...(next === TaskStatus.DONE
            ? {
                completedAt: new Date(),
                completedById: scope.actorId ? new Types.ObjectId(scope.actorId) : null,
              }
            : {}),
          ...(rules.clearBlocked
            ? { blockedReason: null, blockedAt: null, blockedById: null }
            : {}),
          ...(next === TaskStatus.BLOCKED && scope.actorId
            ? { blockedById: new Types.ObjectId(scope.actorId) }
            : {}),
        },
      },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  // ---------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------

  /**
   * Resolves which projects this scope can reach, once per operation.
   *
   * Tasks carry no `clientId`, so they cannot be scoped until this is known.
   * `TasksRepository.scopeFilter` fails closed when it is missing, so
   * forgetting this call produces an empty result rather than a leak — but
   * every public method calls it, so the safe fallback should never fire.
   */
  private async resolveScope(scope: AccessScope): Promise<AccessScope> {
    if (scope.isAdministrator() || scope.isClientContact()) {
      return scope;
    }

    const ids = await this.projects.accessibleProjectIds(scope);

    return scope.withAccessibleProjects((ids ?? []).map((id) => id.toString()));
  }

  /**
   * A task write requires the right to manage the PROJECT, not just to see it.
   *
   * Fetched through the project scope, so a Project Manager who does not own
   * the project gets a 404 — the same answer as a project that does not exist
   * (BR-25, BR-10).
   */
  private async getProjectForWrite(
    projectId: string,
    scope: AccessScope,
  ): Promise<ProjectDocument> {
    const project = await this.projects.findById(projectId, scope);

    if (!project) {
      throw new ResourceNotFoundException(fr.projects.notFound);
    }

    if (project.archivedAt) {
      throw new BusinessRuleViolationException(ErrorCode.PROJECT_ARCHIVED, fr.projects.archived);
    }

    return project;
  }

  /** BR-23 */
  private assertOnTeam(project: ProjectDocument, userId: string): void {
    const onTeam = project.teamMembers.some((member) => member.userId.toString() === userId);

    if (!onTeam) {
      throw new BusinessRuleViolationException(
        ErrorCode.ASSIGNEE_NOT_ON_TEAM,
        fr.tasks.assigneeNotOnTeam,
      );
    }
  }

  /**
   * 06-DB §9 — `milestoneId` points inside another document's array, so no
   * foreign key exists to enforce it. Checking here is the price of embedding.
   */
  private assertMilestoneBelongsToProject(project: ProjectDocument, milestoneId: string): void {
    const exists = project.milestones.some((milestone) => milestone._id.toString() === milestoneId);

    if (!exists) {
      throw new BusinessRuleViolationException(
        ErrorCode.MILESTONE_NOT_IN_PROJECT,
        fr.tasks.milestoneNotInProject,
      );
    }
  }

  private async getOrFail(id: string, scope: AccessScope): Promise<TaskDocument> {
    const found = await this.repository.findById(id, scope);

    if (!found) {
      throw new ResourceNotFoundException(fr.tasks.notFound);
    }

    return found;
  }

  private orFail(document: TaskDocument | null): TaskDocument {
    if (!document) {
      throw new ResourceNotFoundException(fr.tasks.notFound);
    }

    return document;
  }

  private sortField(requested: string | undefined): string {
    const sortable = ['title', 'status', 'dueDate', 'createdAt'];
    return requested && sortable.includes(requested) ? requested : 'dueDate';
  }

  private buildListFilter(query: TaskListQueryDto): FilterQuery<TaskDocument> {
    const filter: FilterQuery<TaskDocument> = {};

    if (query.projectId) filter.projectId = new Types.ObjectId(query.projectId);
    if (query.milestoneId) filter.milestoneId = new Types.ObjectId(query.milestoneId);
    if (query.assigneeId) filter.assigneeId = new Types.ObjectId(query.assigneeId);
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.title = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    return filter;
  }

  // ---------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------

  private async toSummaries(documents: TaskDocument[], scope: AccessScope): Promise<TaskSummary[]> {
    const assignees = await this.users.findByIds(
      [...new Set(documents.map((task) => task.assigneeId.toString()))].map(
        (id) => new Types.ObjectId(id),
      ),
      scope,
    );

    return documents.map((task) => {
      const assignee = assignees.get(task.assigneeId.toString());

      return {
        id: task._id.toString(),
        projectId: task.projectId.toString(),
        milestoneId: task.milestoneId.toString(),
        title: task.title,
        status: task.status,
        assignee: assignee
          ? toUserSummary(assignee)
          : {
              // A soft-deleted assignee stays resolvable (BR-30), so this only
              // fires on genuinely missing data. Better a placeholder than a
              // page that fails because one reference is broken.
              id: task.assigneeId.toString(),
              name: '',
              username: '',
              email: '',
              role: 'TEAM_MEMBER',
              isActive: false,
            },
        ...(task.dueDate ? { dueDate: task.dueDate.toISOString() } : {}),
        ...(task.status === TaskStatus.BLOCKED && task.blockedReason
          ? { blockedReason: task.blockedReason }
          : {}),
      };
    });
  }

  private async toDetail(task: TaskDocument, scope: AccessScope): Promise<TaskDetail> {
    const [summary] = await this.toSummaries([task], scope);

    return {
      ...summary,
      ...(task.description ? { description: task.description } : {}),
      ...(task.blockedAt ? { blockedAt: task.blockedAt.toISOString() } : {}),
      ...(task.completedAt ? { completedAt: task.completedAt.toISOString() } : {}),
      ...(task.completedById ? { completedById: task.completedById.toString() } : {}),
      createdAt: (task.createdAt ?? new Date()).toISOString(),
      updatedAt: (task.updatedAt ?? new Date()).toISOString(),
    };
  }
}
