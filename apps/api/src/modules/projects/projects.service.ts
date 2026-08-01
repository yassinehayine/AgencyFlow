import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  MilestoneStatus,
  PROJECT_STATUS_TRANSITIONS,
  ProjectStatus,
  Role,
} from '@agencyflow/contracts';
import type {
  MilestoneView,
  PaginatedResponse,
  ProjectDetail,
  ProjectSummary,
} from '@agencyflow/contracts';
import { Types, type FilterQuery } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions/domain.exception';
import { fr } from '../../i18n/fr';
import { ClientsRepository } from '../clients/clients.repository';
import { ClientsService } from '../clients/clients.service';
import { UsersRepository } from '../users/users.repository';
import { toUserSummary } from '../users/users.mapper';
import { ProjectsRepository } from './projects.repository';
import {
  TASK_PROGRESS_LOOKUP,
  type MilestoneProgress,
  type TaskProgressLookup,
} from './task-progress.port';
import { MAX_MILESTONES, MAX_TEAM_MEMBERS } from './schemas/project.schema';
import type {
  AddTeamMemberDto,
  ChangeProjectStatusDto,
  CreateProjectDto,
  ProjectListQueryDto,
  ReassignProjectManagerDto,
  UpdateProjectDto,
} from './dto/project.dto';
import type { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';
import type { ProjectDocument } from './schemas/project.schema';

/**
 * Project business rules (FR-019 – FR-026).
 *
 * **Ownership is not checked here, and its absence is the design.** BR-25 says
 * a Project Manager manages only projects they own; that is enforced by the
 * scope filter inside the repository, so `updateById` simply finds nothing for
 * a project someone does not own and the caller gets the same 404 as for a
 * project that never existed (BR-10). An explicit `if (project.projectManagerId
 * !== scope.userId)` here would be a second, weaker copy of a rule the data
 * layer already enforces — and the copy is the one that gets forgotten on the
 * next endpoint.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly users: UsersRepository,
    private readonly clients: ClientsService,
    private readonly clientsRepository: ClientsRepository,
    @Inject(TASK_PROGRESS_LOOKUP) private readonly taskProgress: TaskProgressLookup,
  ) {}

  /** FR-019 */
  async create(dto: CreateProjectDto, scope: AccessScope): Promise<ProjectDetail> {
    this.assertDateOrder(new Date(dto.startDate), new Date(dto.endDate));

    // Both references are verified before anything is written. A project
    // pointing at a client or a manager that does not exist is unreachable
    // through every scope rule at once, and invisible to the person who
    // created it.
    await this.clients.assertUsableForNewWork(dto.clientId, scope);
    await this.assertCanManageProjects(dto.projectManagerId);

    const created = await this.repository.create(
      {
        name: dto.name,
        ...(dto.description ? { description: dto.description } : {}),
        clientId: new Types.ObjectId(dto.clientId),
        projectManagerId: new Types.ObjectId(dto.projectManagerId),
        // Always PLANNED. Not accepted from the request (SRS section 6.4).
        status: ProjectStatus.PLANNED,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        teamMembers: [],
        milestones: [],
      },
      scope,
    );

    return this.toDetail(created, scope);
  }

  /** FR-025 — the list every role sees differently. */
  async findAll(
    query: ProjectListQueryDto,
    scope: AccessScope,
  ): Promise<PaginatedResponse<ProjectSummary>> {
    const filter = this.buildListFilter(query);

    const [documents, totalItems] = await Promise.all([
      this.repository.findMany(filter, scope, {
        skip: query.skip,
        limit: query.pageSize,
        sort: { [this.sortField(query.sortBy)]: query.sortOrder === 'desc' ? -1 : 1 },
      }),
      this.repository.count(filter, scope),
    ]);

    // One query for every organisation on the page, not one per row. The
    // alternative is an N+1 that only shows up once a real agency has more
    // than a screenful of projects.
    const clientNames = await this.clientsRepository.findNamesByIds(
      [...new Set(documents.map((document) => document.clientId.toString()))].map(
        (id) => new Types.ObjectId(id),
      ),
      scope,
    );

    return paginate(
      documents.map((document) => this.toSummary(document, clientNames)),
      totalItems,
      query,
    );
  }

  /** FR-026 */
  async findById(id: string, scope: AccessScope): Promise<ProjectDetail> {
    return this.toDetail(await this.getOrFail(id, scope), scope);
  }

  /** FR-020 */
  async update(id: string, dto: UpdateProjectDto, scope: AccessScope): Promise<ProjectDetail> {
    const existing = await this.getOrFailWritable(id, scope);

    // Compared against the merged result, not the patch: sending only a new
    // end date must still be checked against the stored start date, or a
    // one-field edit can produce a project that ends before it begins.
    this.assertDateOrder(
      dto.startDate ? new Date(dto.startDate) : existing.startDate,
      dto.endDate ? new Date(dto.endDate) : existing.endDate,
    );

    const updated = await this.repository.updateById(
      id,
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
          ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        },
      },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  /**
   * FR-021 — a named command, never a PATCH of `status`.
   *
   * The transition table is the whole rule (SRS section 6.4). Checking it here
   * rather than trusting the interface matters because the endpoint is
   * callable directly: without this, a project could go from `COMPLETED` back
   * to `PLANNED` and every progress figure derived from it would silently
   * change meaning.
   */
  async changeStatus(
    id: string,
    dto: ChangeProjectStatusDto,
    scope: AccessScope,
  ): Promise<ProjectDetail> {
    const existing = await this.getOrFailWritable(id, scope);

    if (existing.status === dto.status) {
      // Idempotent rather than an error: a double-clicked button should not
      // produce a failure the user has to interpret.
      return this.toDetail(existing, scope);
    }

    if (!PROJECT_STATUS_TRANSITIONS[existing.status].includes(dto.status)) {
      throw new BusinessRuleViolationException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        fr.projects.invalidStatusTransition(existing.status, dto.status),
      );
    }

    const updated = await this.repository.updateById(id, { $set: { status: dto.status } }, scope);

    return this.toDetail(this.orFail(updated), scope);
  }

  /**
   * FR-022 — Administrator only (BR-24).
   *
   * The route is `@Roles(ADMINISTRATOR)`, so a Project Manager cannot hand
   * their own project to someone else — nor take one. Worth stating because
   * the outgoing PM loses all access the moment this succeeds: their scope
   * filter stops matching the project on their very next request.
   */
  async reassignProjectManager(
    id: string,
    dto: ReassignProjectManagerDto,
    scope: AccessScope,
  ): Promise<ProjectDetail> {
    await this.getOrFailWritable(id, scope);
    await this.assertCanManageProjects(dto.projectManagerId);

    const updated = await this.repository.updateById(
      id,
      { $set: { projectManagerId: new Types.ObjectId(dto.projectManagerId) } },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  /** FR-023 — BR-23. */
  async addTeamMember(
    id: string,
    dto: AddTeamMemberDto,
    scope: AccessScope,
  ): Promise<ProjectDetail> {
    const project = await this.getOrFailWritable(id, scope);

    if (project.teamMembers.length >= MAX_TEAM_MEMBERS) {
      throw new BusinessRuleViolationException(
        ErrorCode.TEAM_LIMIT_REACHED,
        fr.projects.teamLimitReached,
      );
    }

    if (project.teamMembers.some((member) => member.userId.toString() === dto.userId)) {
      throw new ResourceConflictException(
        ErrorCode.ALREADY_TEAM_MEMBER,
        fr.projects.alreadyTeamMember,
      );
    }

    // Only a TEAM_MEMBER may join a team (BR-23). A Project Manager or a
    // client contact in `teamMembers[]` would satisfy the BR-26 scope filter
    // and quietly grant project access through the wrong door.
    const candidate = await this.users.findActiveById(dto.userId);

    if (!candidate || candidate.role !== Role.TEAM_MEMBER) {
      throw new BusinessRuleViolationException(
        ErrorCode.INVALID_TEAM_MEMBER,
        fr.projects.invalidTeamMember,
      );
    }

    const updated = await this.repository.updateById(
      id,
      {
        $push: {
          teamMembers: {
            userId: new Types.ObjectId(dto.userId),
            addedAt: new Date(),
            ...(scope.actorId ? { addedById: new Types.ObjectId(scope.actorId) } : {}),
          },
        },
      },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  /**
   * FR-024.
   *
   * Now fully enforced: the open-task half arrived with `TasksModule`, through
   * the same port that supplies milestone progress. Removing a member who
   * still holds outstanding work would leave those tasks assigned to somebody
   * no longer on the team, which contradicts BR-23.
   */
  async removeTeamMember(id: string, userId: string, scope: AccessScope): Promise<ProjectDetail> {
    const project = await this.getOrFailWritable(id, scope);

    if (!project.teamMembers.some((member) => member.userId.toString() === userId)) {
      throw new ResourceNotFoundException(fr.projects.notFound);
    }

    const openTasks = await this.taskProgress.countOpenTasksForMember(
      project._id,
      new Types.ObjectId(userId),
    );

    if (openTasks > 0) {
      throw new BusinessRuleViolationException(
        ErrorCode.MEMBER_HAS_OPEN_TASKS,
        fr.tasks.memberHasOpenTasks,
      );
    }

    const updated = await this.repository.updateById(
      id,
      { $pull: { teamMembers: { userId: new Types.ObjectId(userId) } } },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  // ---------------------------------------------------------------------
  // Milestones — embedded, so ProjectsModule is their sole writer (ADR-0004)
  // ---------------------------------------------------------------------

  /** FR-029 */
  async createMilestone(
    id: string,
    dto: CreateMilestoneDto,
    scope: AccessScope,
  ): Promise<ProjectDetail> {
    const project = await this.getOrFailWritable(id, scope);

    if (project.milestones.length >= MAX_MILESTONES) {
      throw new BusinessRuleViolationException(
        ErrorCode.MILESTONE_LIMIT_REACHED,
        fr.projects.milestoneLimitReached,
      );
    }

    this.assertOrderFree(project, dto.order);

    const updated = await this.repository.updateById(
      id,
      {
        $push: {
          milestones: {
            _id: new Types.ObjectId(),
            name: dto.name,
            ...(dto.description ? { description: dto.description } : {}),
            ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
            order: dto.order,
            createdAt: new Date(),
            ...(scope.actorId ? { createdById: new Types.ObjectId(scope.actorId) } : {}),
          },
        },
      },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  /**
   * FR-030.
   *
   * Only the four descriptive fields are writable. Status and progress are not
   * accepted, not stored, and not settable by any route — they are derived
   * from tasks on every read (BR-08).
   */
  async updateMilestone(
    id: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    scope: AccessScope,
  ): Promise<ProjectDetail> {
    const project = await this.getOrFailWritable(id, scope);
    const existing = this.findMilestone(project, milestoneId);

    if (dto.order !== undefined && dto.order !== existing.order) {
      this.assertOrderFree(project, dto.order);
    }

    const set: Record<string, unknown> = {};
    if (dto.name !== undefined) set['milestones.$[m].name'] = dto.name;
    if (dto.description !== undefined) set['milestones.$[m].description'] = dto.description;
    if (dto.dueDate !== undefined) set['milestones.$[m].dueDate'] = new Date(dto.dueDate);
    if (dto.order !== undefined) set['milestones.$[m].order'] = dto.order;

    const updated = await this.repository.updateEmbedded(
      id,
      { $set: set },
      [{ 'm._id': new Types.ObjectId(milestoneId) }],
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  /**
   * FR-034.
   *
   * Refused while the milestone still holds tasks that are neither DONE nor
   * CANCELLED. Deleting it regardless would leave those tasks pointing at a
   * milestone that no longer exists — and because `milestoneId` references an
   * EMBEDDED document, no database constraint would catch it (06-DB §9).
   */
  async deleteMilestone(
    id: string,
    milestoneId: string,
    scope: AccessScope,
  ): Promise<ProjectDetail> {
    const project = await this.getOrFailWritable(id, scope);
    this.findMilestone(project, milestoneId);

    const openTasks = await this.taskProgress.progressByMilestone(project._id);
    const rollup = openTasks.get(milestoneId);

    if (rollup && rollup.openTaskCount > 0) {
      throw new BusinessRuleViolationException(
        ErrorCode.MILESTONE_HAS_OPEN_TASKS,
        fr.tasks.milestoneHasOpenTasks,
      );
    }

    const updated = await this.repository.updateById(
      id,
      { $pull: { milestones: { _id: new Types.ObjectId(milestoneId) } } },
      scope,
    );

    return this.toDetail(this.orFail(updated), scope);
  }

  /** `order` defines the roadmap sequence, so duplicates make it ambiguous. */
  private assertOrderFree(project: ProjectDocument, order: number): void {
    if (project.milestones.some((milestone) => milestone.order === order)) {
      throw new ResourceConflictException(
        ErrorCode.MILESTONE_ORDER_TAKEN,
        fr.projects.milestoneOrderTaken,
      );
    }
  }

  private findMilestone(
    project: ProjectDocument,
    milestoneId: string,
  ): ProjectDocument['milestones'][number] {
    const found = project.milestones.find((milestone) => milestone._id.toString() === milestoneId);

    if (!found) {
      throw new ResourceNotFoundException(fr.projects.milestoneNotFound);
    }

    return found;
  }

  // ---------------------------------------------------------------------
  // Shared rules
  // ---------------------------------------------------------------------

  private assertDateOrder(start: Date, end: Date): void {
    if (end.getTime() < start.getTime()) {
      throw new BusinessRuleViolationException(
        ErrorCode.END_DATE_BEFORE_START_DATE,
        fr.projects.endBeforeStart,
      );
    }
  }

  /**
   * BR-24 — the owning manager must be an active `PROJECT_MANAGER` or
   * `ADMINISTRATOR`.
   *
   * An Administrator is allowed because a small agency has one, and a project
   * created before a manager is hired still needs an owner. A Team Member is
   * not: `projectManagerId` grants edit rights over the whole project, and the
   * permission matrix gives a Team Member none.
   */
  private async assertCanManageProjects(userId: string): Promise<void> {
    const candidate = await this.users.findActiveById(userId);

    if (
      !candidate ||
      (candidate.role !== Role.PROJECT_MANAGER && candidate.role !== Role.ADMINISTRATOR)
    ) {
      throw new BusinessRuleViolationException(
        ErrorCode.INVALID_PROJECT_MANAGER,
        fr.projects.invalidProjectManager,
      );
    }
  }

  private async getOrFail(id: string, scope: AccessScope): Promise<ProjectDocument> {
    const found = await this.repository.findById(id, scope);

    if (!found) {
      throw new ResourceNotFoundException(fr.projects.notFound);
    }

    return found;
  }

  /** FR-027 — an archived project is readable but not writable. */
  private async getOrFailWritable(id: string, scope: AccessScope): Promise<ProjectDocument> {
    const project = await this.getOrFail(id, scope);

    if (project.archivedAt) {
      throw new ResourceConflictException(ErrorCode.PROJECT_ARCHIVED, fr.projects.archived);
    }

    return project;
  }

  /**
   * A write that reaches this point has already passed the scope filter, so a
   * null result means the document disappeared between two statements. Real,
   * rare, and a 404 rather than a 500.
   */
  private orFail(document: ProjectDocument | null): ProjectDocument {
    if (!document) {
      throw new ResourceNotFoundException(fr.projects.notFound);
    }

    return document;
  }

  private sortField(requested: string | undefined): string {
    const sortable = ['name', 'status', 'startDate', 'endDate', 'createdAt'];
    return requested && sortable.includes(requested) ? requested : 'endDate';
  }

  private buildListFilter(query: ProjectListQueryDto): FilterQuery<ProjectDocument> {
    const filter: FilterQuery<ProjectDocument> = {};

    if (!query.includeArchived) {
      filter.archivedAt = null;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }
    if (query.projectManagerId) {
      filter.projectManagerId = new Types.ObjectId(query.projectManagerId);
    }
    if (query.search) {
      filter.name = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    return filter;
  }

  // ---------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------

  /**
   * `clientName` degrades to an empty string when the organisation is outside
   * the caller's scope — which cannot happen for a project they can already
   * see, but is the safe behaviour if it ever does. A missing label is a
   * cosmetic defect; a leaked one crosses BR-10.
   */
  private toSummary(document: ProjectDocument, clientNames: Map<string, string>): ProjectSummary {
    return {
      id: document._id.toString(),
      name: document.name,
      clientId: document.clientId.toString(),
      clientName: clientNames.get(document.clientId.toString()) ?? '',
      projectManagerId: document.projectManagerId.toString(),
      status: document.status,
      startDate: document.startDate.toISOString(),
      endDate: document.endDate.toISOString(),
      isArchived: Boolean(document.archivedAt),
      teamSize: document.teamMembers.length,
      milestoneCount: document.milestones.length,
    };
  }

  /**
   * BR-28 — a Client Contact never sees the team roster.
   *
   * The field is OMITTED rather than emptied, so "you may not see this" stays
   * distinguishable from "nobody is assigned". An empty array would let a
   * client conclude the agency has put no one on their project.
   */
  private async toDetail(document: ProjectDocument, scope: AccessScope): Promise<ProjectDetail> {
    const isClient = scope.isClientContact();

    // A Client Contact is never shown the roster, so their team members are
    // never fetched either. Not fetching what will not be sent is both cheaper
    // and one fewer place a filtering mistake could leak it.
    const userIds = [
      document.projectManagerId,
      ...(isClient ? [] : document.teamMembers.map((member) => member.userId)),
    ];

    const [clientNames, users, progress] = await Promise.all([
      this.clientsRepository.findNamesByIds([document.clientId], scope),
      this.users.findByIds(userIds, scope),
      // FR-031, FR-032 — one aggregation for the whole roadmap, not one per
      // milestone. Unscoped by design: a Client Contact may see progress
      // (FR-033) while seeing no tasks at all (BR-28).
      this.taskProgress.progressByMilestone(document._id),
    ]);

    const summary = this.toSummary(document, clientNames);
    const manager = users.get(document.projectManagerId.toString());

    return {
      ...summary,
      ...(document.description ? { description: document.description } : {}),
      projectManagerName: manager?.name ?? '',
      ...(isClient
        ? {}
        : {
            team: document.teamMembers.flatMap((member) => {
              const user = users.get(member.userId.toString());

              // A member whose account was hard-removed is skipped rather than
              // rendered as a blank row. Soft-deleted users stay resolvable,
              // so this only fires on genuinely missing data (BR-30).
              return user
                ? [{ user: toUserSummary(user), addedAt: member.addedAt.toISOString() }]
                : [];
            }),
          }),
      milestones: document.milestones
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((milestone) => this.toMilestoneView(milestone, progress)),
      createdAt: (document.createdAt ?? new Date()).toISOString(),
      updatedAt: (document.updatedAt ?? new Date()).toISOString(),
    };
  }

  /**
   * BR-08 — status and progress are computed, never stored.
   *
   * The values come from an aggregation over this project's tasks, performed
   * on every read. `06-Database-Design.md` §7.3 forbids persisting them even
   * as a cache: a stored copy can disagree with the tasks it summarises, and
   * the disagreement is silent — no error, just a wrong percentage shown to a
   * client deciding whether to approve work.
   *
   * A milestone with no tasks is ABSENT from the map rather than zero-filled,
   * so the fallback below is the formula evaluated on an empty set: 0% because
   * the denominator is 0, and NOT_STARTED because no task has left TODO.
   */
  private toMilestoneView(
    milestone: ProjectDocument['milestones'][number],
    progress: Map<string, MilestoneProgress>,
  ): MilestoneView {
    const rollup = progress.get(milestone._id.toString());

    return {
      id: milestone._id.toString(),
      name: milestone.name,
      ...(milestone.description ? { description: milestone.description } : {}),
      ...(milestone.dueDate ? { dueDate: milestone.dueDate.toISOString() } : {}),
      order: milestone.order,
      status: rollup?.status ?? MilestoneStatus.NOT_STARTED,
      progress: rollup?.progress ?? 0,
    };
  }
}
