import { Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_LIMITS,
  DeliverableStatus,
  ProjectStatus,
  Role,
  TaskStatus,
  progressPercentage,
} from '@agencyflow/contracts';
import type {
  AdministratorDashboard,
  ClientDashboard,
  DashboardDeliverable,
  DashboardList,
  DashboardMilestone,
  DashboardProject,
  DashboardResponse,
  DashboardTask,
  DeadlineAlerts,
  ProjectManagerDashboard,
  TaskStatusGroup,
  TeamMemberDashboard,
  WorkloadEntry,
} from '@agencyflow/contracts';
import { Types } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { ClientsRepository } from '../clients/clients.repository';
import { DeliverablesRepository } from '../deliverables/deliverables.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { UsersRepository } from '../users/users.repository';
import {
  TASK_INSIGHTS_LOOKUP,
  type ProjectTaskRollup,
  type TaskInsight,
  type TaskInsightCriteria,
  type TaskInsightsLookup,
} from './task-insights.port';
import type { DeliverableDocument } from '../deliverables/schemas/deliverable.schema';
import type { ProjectDocument } from '../projects/schemas/project.schema';

/** The board order of the working day, and the order the columns render in. */
const BOARD_STATUSES: readonly TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.BLOCKED,
];

const OPEN_STATUSES: readonly TaskStatus[] = BOARD_STATUSES;

/** Projects an Administrator is actually running right now (FR-068). */
const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.PLANNED,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
];

/** Deliverables the ball is in the client's court on (FR-068, FR-069). */
const AWAITING_CLIENT_STATUSES: readonly DeliverableStatus[] = [
  DeliverableStatus.SUBMITTED,
  DeliverableStatus.UNDER_REVIEW,
];

/**
 * The read model (FR-068 – FR-072, 05-Software-Architecture.md §7).
 *
 * It reads from four modules and is written to by none — the one place in the
 * system where a cross-module read is expected, and it holds no business rules
 * of its own. Everything it shows is a projection of a rule enforced
 * elsewhere: BR-04 decides what "awaiting my review" means, BR-10 decides what
 * a client can see, and this service only asks.
 *
 * **`now` is taken once, at the top of the request, and threaded through.**
 * Every deadline boundary derives from that single instant, so a dashboard
 * cannot classify a task as due-soon in one panel and overdue in the next
 * because midnight passed between two queries. Rare, real, and impossible to
 * reproduce once reported.
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly deliverables: DeliverablesRepository,
    private readonly users: UsersRepository,
    private readonly clients: ClientsRepository,
    @Inject(TASK_INSIGHTS_LOOKUP) private readonly tasks: TaskInsightsLookup,
  ) {}

  /**
   * The one entry point. Which dashboard you get is decided by the role on the
   * scope — which came from the database on this request (ADR-0005), not from
   * the token — so a demoted Administrator gets the Team Member view
   * immediately rather than at token expiry.
   */
  async findForCurrentUser(
    rawScope: AccessScope,
    now: Date = new Date(),
  ): Promise<DashboardResponse> {
    const scope = await this.resolveScope(rawScope);

    switch (scope.role) {
      case Role.ADMINISTRATOR:
        return this.administratorDashboard(scope, now);
      case Role.PROJECT_MANAGER:
        return this.projectManagerDashboard(scope, now);
      case Role.CLIENT_CONTACT:
        return this.clientDashboard(scope, now);
      default:
        return this.teamMemberDashboard(scope, now);
    }
  }

  // ---------------------------------------------------------------------
  // FR-068 — Administrator
  // ---------------------------------------------------------------------

  private async administratorDashboard(
    scope: AccessScope,
    now: Date,
  ): Promise<AdministratorDashboard> {
    const [countsByStatus, activeProjects, overdueTasks, awaitingClientApproval, workload] =
      await Promise.all([
        this.projectCountsByStatus(scope),
        this.projectList(scope, { statuses: ACTIVE_PROJECT_STATUSES }),
        this.taskList(
          { statuses: OPEN_STATUSES, deadline: 'OVERDUE', limit: DASHBOARD_LIMITS.ATTENTION },
          scope,
          now,
        ),
        this.deliverableList(scope, AWAITING_CLIENT_STATUSES, { sort: { updatedAt: -1 } }),
        this.tasks.workloadByAssignee(scope, now, DASHBOARD_LIMITS.WORKLOAD),
      ]);

    return {
      role: Role.ADMINISTRATOR,
      projectCountsByStatus: countsByStatus,
      activeProjects,
      teamWorkload: await this.namedWorkload(workload, scope),
      overdueTasks,
      awaitingClientApproval,
    };
  }

  // ---------------------------------------------------------------------
  // FR-069 — Project Manager, scoped to owned projects (BR-25)
  // ---------------------------------------------------------------------

  private async projectManagerDashboard(
    scope: AccessScope,
    now: Date,
  ): Promise<ProjectManagerDashboard> {
    const [myProjects, awaitingMyReview, awaitingClientResponse, blockedTasks, alerts] =
      await Promise.all([
        this.projectList(scope, {}),
        // The primary call to action. `IN_REVIEW` is the one status a Team
        // Member cannot clear themselves (BR-04), so every task here is
        // waiting on this person specifically.
        this.taskList(
          { statuses: [TaskStatus.IN_REVIEW], limit: DASHBOARD_LIMITS.ATTENTION },
          scope,
          now,
        ),
        this.deliverableList(scope, AWAITING_CLIENT_STATUSES, { sort: { updatedAt: -1 } }),
        this.taskList(
          { statuses: [TaskStatus.BLOCKED], limit: DASHBOARD_LIMITS.ATTENTION },
          scope,
          now,
        ),
        this.deadlineAlerts(scope, now),
      ]);

    return {
      role: Role.PROJECT_MANAGER,
      myProjects,
      awaitingMyReview,
      awaitingClientResponse,
      blockedTasks,
      alerts,
    };
  }

  // ---------------------------------------------------------------------
  // FR-070 — Team Member, scoped to their own assignments (BR-26)
  // ---------------------------------------------------------------------

  private async teamMemberDashboard(scope: AccessScope, now: Date): Promise<TeamMemberDashboard> {
    // One query for the whole board rather than four. The columns are a
    // grouping of the same set, and four round trips could disagree with each
    // other if a task moved between them.
    const [board, alerts, completed] = await Promise.all([
      this.tasks.findTasks(
        { statuses: BOARD_STATUSES, assigneeId: scope.userId, limit: DASHBOARD_LIMITS.MY_TASKS },
        scope,
        now,
      ),
      this.deadlineAlerts(scope, now, scope.userId),
      this.tasks.findTasks(
        { statuses: [TaskStatus.DONE], assigneeId: scope.userId, limit: 1 },
        scope,
        now,
      ),
    ]);

    const decorated = await this.decorateTasks(board.items, scope);

    return {
      role: Role.TEAM_MEMBER,
      // Every column is present, including the empty ones: a board missing its
      // "Bloquée" column reads as a rendering fault, not as good news.
      tasksByStatus: BOARD_STATUSES.map<TaskStatusGroup>((status) => ({
        status,
        tasks: decorated.filter((task) => task.status === status),
      })),
      alerts,
      completedTaskCount: completed.total,
    };
  }

  // ---------------------------------------------------------------------
  // FR-071 — Client Contact, scoped to their organisation (BR-10)
  // ---------------------------------------------------------------------

  /**
   * The portal's landing page, and the only dashboard that asks nothing about
   * tasks — not because the queries would leak (the scope filter refuses a
   * client every task in the system) but because BR-28 means there is nothing
   * here for them to be told. `ClientDashboard` has no field to put one in.
   */
  private async clientDashboard(scope: AccessScope, now: Date): Promise<ClientDashboard> {
    const [projectDocuments, projectTotal] = await Promise.all([
      this.projects.findMany({ archivedAt: null }, scope, {
        sort: { endDate: 1 },
        limit: DASHBOARD_LIMITS.PROJECTS,
      }),
      this.projects.count({ archivedAt: null }, scope),
    ]);

    const [projects, awaitingMyApproval, recentlyApproved] = await Promise.all([
      this.toProjectList(projectDocuments, scope, { total: projectTotal, withTaskCounts: false }),
      // The most prominent item on the page when it is non-empty (US-059).
      // `SUBMITTED` and `UNDER_REVIEW` both wait on the client: starting the
      // review is explicit (BR-31), so a contact who never presses it must
      // still see the work waiting for them.
      this.deliverableList(scope, AWAITING_CLIENT_STATUSES, { sort: { updatedAt: -1 } }),
      this.deliverableList(scope, [DeliverableStatus.APPROVED], { sort: { approvedAt: -1 } }),
    ]);

    return {
      role: Role.CLIENT_CONTACT,
      projects,
      awaitingMyApproval,
      recentlyApproved,
      upcomingMilestones: this.upcomingMilestones(projectDocuments, now),
    };
  }

  // ---------------------------------------------------------------------
  // Shared reads
  // ---------------------------------------------------------------------

  /**
   * Resolves which projects this scope can reach, once per request.
   *
   * 08-Backend-Design §3.3 calls for this to be lazy and memoized; a dashboard
   * is the case it was written for, since every panel needs the same list.
   * Administrators and Client Contacts are skipped because their filters are
   * expressible directly — `{}` and `clientId` respectively.
   */
  private async resolveScope(scope: AccessScope): Promise<AccessScope> {
    if (scope.isAdministrator() || scope.isClientContact()) {
      return scope;
    }

    const ids = await this.projects.accessibleProjectIds(scope);

    return scope.withAccessibleProjects((ids ?? []).map((id) => id.toString()));
  }

  /** FR-072, BR-20 — both windows computed from the same instant. */
  private async deadlineAlerts(
    scope: AccessScope,
    now: Date,
    assigneeId?: string,
  ): Promise<DeadlineAlerts> {
    const base = {
      // A `DONE` or `CANCELLED` task is never late, whatever its date says.
      statuses: OPEN_STATUSES,
      ...(assigneeId ? { assigneeId } : {}),
      limit: DASHBOARD_LIMITS.ATTENTION,
    };

    const [dueSoon, overdue] = await Promise.all([
      this.taskList({ ...base, deadline: 'DUE_SOON' }, scope, now),
      this.taskList({ ...base, deadline: 'OVERDUE' }, scope, now),
    ]);

    return { dueSoon, overdue };
  }

  private async taskList(
    criteria: TaskInsightCriteria,
    scope: AccessScope,
    now: Date,
  ): Promise<DashboardList<DashboardTask>> {
    const { items, total } = await this.tasks.findTasks(criteria, scope, now);

    return { items: await this.decorateTasks(items, scope), total };
  }

  /**
   * Attaches the project and assignee names.
   *
   * Two queries for the whole list, not two per row. An N+1 here is invisible
   * with a demo database and is the first thing to fall over under QA-4's
   * thousand projects.
   */
  private async decorateTasks(
    insights: TaskInsight[],
    scope: AccessScope,
  ): Promise<DashboardTask[]> {
    if (insights.length === 0) {
      return [];
    }

    const [projectNames, users] = await Promise.all([
      this.projectNames(
        insights.map((task) => task.projectId),
        scope,
      ),
      this.users.findByIds(this.uniqueIds(insights.map((task) => task.assigneeId)), scope),
    ]);

    return insights.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      projectId: task.projectId,
      // An empty label rather than a missing row. A name that cannot be
      // resolved is a cosmetic defect; dropping the task would hide work.
      projectName: projectNames.get(task.projectId) ?? '',
      assigneeId: task.assigneeId,
      assigneeName: users.get(task.assigneeId)?.name ?? '',
      ...(task.dueDate ? { dueDate: task.dueDate.toISOString() } : {}),
      ...(task.blockedReason ? { blockedReason: task.blockedReason } : {}),
    }));
  }

  private async projectNames(ids: string[], scope: AccessScope): Promise<Map<string, string>> {
    const unique = this.uniqueIds(ids);

    if (unique.length === 0) {
      return new Map();
    }

    const documents = await this.projects.findMany({ _id: { $in: unique } }, scope, {});

    return new Map(documents.map((document) => [document._id.toString(), document.name]));
  }

  private async projectCountsByStatus(scope: AccessScope): Promise<Record<ProjectStatus, number>> {
    const counts = await Promise.all(
      Object.values(ProjectStatus).map(async (status) => ({
        status,
        count: await this.projects.count({ status, archivedAt: null }, scope),
      })),
    );

    // Zero-filled from the enum, so a status nobody is using shows "0" rather
    // than vanishing from the panel — "no projects on hold" is information.
    return counts.reduce<Record<ProjectStatus, number>>(
      (accumulator, entry) => ({ ...accumulator, [entry.status]: entry.count }),
      {} as Record<ProjectStatus, number>,
    );
  }

  private async projectList(
    scope: AccessScope,
    options: { statuses?: readonly ProjectStatus[] },
  ): Promise<DashboardList<DashboardProject>> {
    const filter = {
      archivedAt: null,
      ...(options.statuses ? { status: { $in: options.statuses } } : {}),
    };

    const [documents, total] = await Promise.all([
      this.projects.findMany(filter, scope, {
        sort: { endDate: 1 },
        limit: DASHBOARD_LIMITS.PROJECTS,
      }),
      this.projects.count(filter, scope),
    ]);

    return this.toProjectList(documents, scope, { total, withTaskCounts: true });
  }

  private async toProjectList(
    documents: ProjectDocument[],
    scope: AccessScope,
    options: { total: number; withTaskCounts: boolean },
  ): Promise<DashboardList<DashboardProject>> {
    if (documents.length === 0) {
      return { items: [], total: options.total };
    }

    const [rollups, clientNames] = await Promise.all([
      this.tasks.progressByProject(documents.map((document) => document._id)),
      this.clients.findNamesByIds(
        this.uniqueIds(documents.map((document) => document.clientId.toString())),
        scope,
      ),
    ]);

    return {
      items: documents.map((document) =>
        this.toDashboardProject(document, rollups, clientNames, options.withTaskCounts),
      ),
      total: options.total,
    };
  }

  private toDashboardProject(
    document: ProjectDocument,
    rollups: Map<string, ProjectTaskRollup>,
    clientNames: Map<string, string>,
    withTaskCounts: boolean,
  ): DashboardProject {
    const rollup = rollups.get(document._id.toString());

    return {
      id: document._id.toString(),
      name: document.name,
      clientName: clientNames.get(document.clientId.toString()) ?? '',
      status: document.status,
      endDate: document.endDate.toISOString(),
      progress: progressPercentage(rollup?.done ?? 0, rollup?.total ?? 0),
      // BR-28 — omitted for a client, not zeroed. An outstanding-work count is
      // internal, and "0" would be a statement about the agency's progress
      // that this dashboard is not entitled to make.
      ...(withTaskCounts ? { openTaskCount: rollup?.open ?? 0 } : {}),
    };
  }

  private async deliverableList(
    scope: AccessScope,
    statuses: readonly DeliverableStatus[],
    options: { sort: Record<string, 1 | -1> },
  ): Promise<DashboardList<DashboardDeliverable>> {
    const filter = { status: { $in: statuses } };

    const [documents, total] = await Promise.all([
      this.deliverables.findMany(filter, scope, {
        sort: options.sort,
        limit: DASHBOARD_LIMITS.ATTENTION,
      }),
      this.deliverables.count(filter, scope),
    ]);

    const projectNames = await this.projectNames(
      documents.map((document) => document.projectId.toString()),
      scope,
    );

    return {
      items: documents.map((document) => this.toDashboardDeliverable(document, projectNames)),
      total,
    };
  }

  /**
   * Never spreads the document. `versions[].files[].storageKey` is the provider
   * handle that ADR-0003 S-2 keeps server-side, and a dashboard is exactly the
   * kind of convenience endpoint where a spread would smuggle it out.
   */
  private toDashboardDeliverable(
    document: DeliverableDocument,
    projectNames: Map<string, string>,
  ): DashboardDeliverable {
    const current = document.versions[document.versions.length - 1];

    return {
      id: document._id.toString(),
      name: document.name,
      status: document.status,
      projectId: document.projectId.toString(),
      projectName: projectNames.get(document.projectId.toString()) ?? '',
      currentVersionNumber: document.currentVersionNumber,
      ...(document.dueDate ? { dueDate: document.dueDate.toISOString() } : {}),
      ...(current?.submittedAt ? { submittedAt: current.submittedAt.toISOString() } : {}),
      ...(document.approvedAt ? { approvedAt: document.approvedAt.toISOString() } : {}),
    };
  }

  /**
   * FR-071 — milestones still ahead, across the client's projects.
   *
   * Computed from the project documents already in hand rather than by a
   * second query: milestones are embedded (ADR-0004), so they arrived with the
   * projects, and asking again would be a round trip for data already loaded.
   *
   * Completed milestones are excluded by DATE only here. Their computed status
   * needs a task aggregation per project, and a milestone whose due date has
   * not passed is "upcoming" whether or not the work inside it happens to be
   * finished — which is the honest reading of the word.
   */
  private upcomingMilestones(
    documents: ProjectDocument[],
    now: Date,
  ): DashboardList<DashboardMilestone> {
    const all = documents.flatMap((project) =>
      project.milestones.flatMap<DashboardMilestone>((milestone) =>
        // A milestone with no due date is not upcoming — it is undated, which
        // is a different thing and belongs on the project page, not here.
        milestone.dueDate && milestone.dueDate.getTime() >= now.getTime()
          ? [
              {
                id: milestone._id.toString(),
                name: milestone.name,
                projectId: project._id.toString(),
                projectName: project.name,
                dueDate: milestone.dueDate.toISOString(),
              },
            ]
          : [],
      ),
    );

    all.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return { items: all.slice(0, DASHBOARD_LIMITS.MILESTONES), total: all.length };
  }

  private async namedWorkload(
    rows: { assigneeId: string; openTaskCount: number; overdueTaskCount: number }[],
    scope: AccessScope,
  ): Promise<WorkloadEntry[]> {
    if (rows.length === 0) {
      return [];
    }

    const users = await this.users.findByIds(
      this.uniqueIds(rows.map((row) => row.assigneeId)),
      scope,
    );

    return rows.map((row) => ({
      userId: row.assigneeId,
      name: users.get(row.assigneeId)?.name ?? '',
      openTaskCount: row.openTaskCount,
      overdueTaskCount: row.overdueTaskCount,
    }));
  }

  private uniqueIds(ids: string[]): Types.ObjectId[] {
    return [...new Set(ids)].map((id) => new Types.ObjectId(id));
  }
}
