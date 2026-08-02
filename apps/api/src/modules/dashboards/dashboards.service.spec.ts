import { DeliverableStatus, ProjectStatus, Role, TaskStatus } from '@agencyflow/contracts';
import { Types } from 'mongoose';

import { AccessScope } from '../../core/authorization/access-scope';
import { DashboardsService } from './dashboards.service';
import type { ClientsRepository } from '../clients/clients.repository';
import type { DeliverablesRepository } from '../deliverables/deliverables.repository';
import type { ProjectsRepository } from '../projects/projects.repository';
import type { UsersRepository } from '../users/users.repository';
import type { TaskInsightCriteria, TaskInsightsLookup } from './task-insights.port';

/**
 * The read model (FR-068 – FR-072).
 *
 * A dashboard holds no rules of its own, so what is worth testing is not
 * arithmetic but **which questions it asks and what shape it hands back**. The
 * mistakes available here are of one kind: asking for more than the caller may
 * see, or reporting something the caller is not entitled to. Both are silent.
 *
 * The task lookup is a spy that RECORDS its criteria. Asserting on the recorded
 * criteria is the point — it is how a test can prove a Team Member's dashboard
 * asked only for their own work, rather than proving that the fake happened to
 * return only their own work.
 */
const PROJECT_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId().toString();
const CLIENT_ID = new Types.ObjectId().toString();
const ASSIGNEE_ID = new Types.ObjectId().toString();

const scopeOf = (role: Role) =>
  AccessScope.forUser({
    userId: USER_ID,
    role,
    ...(role === Role.CLIENT_CONTACT ? { clientId: CLIENT_ID } : {}),
  });

const NOW = new Date('2026-08-02T09:00:00.000Z');

function projectDocument(overrides: Record<string, unknown> = {}) {
  return {
    _id: PROJECT_ID,
    name: 'Refonte site vitrine',
    clientId: new Types.ObjectId(CLIENT_ID),
    status: ProjectStatus.IN_PROGRESS,
    endDate: new Date('2026-09-30T00:00:00.000Z'),
    milestones: [
      {
        _id: new Types.ObjectId(),
        name: 'Maquettes',
        order: 1,
        dueDate: new Date('2026-08-20T00:00:00.000Z'),
      },
      {
        _id: new Types.ObjectId(),
        name: 'Cadrage',
        order: 0,
        // Already past: not upcoming, and must not be listed as though it were.
        dueDate: new Date('2026-07-01T00:00:00.000Z'),
      },
      { _id: new Types.ObjectId(), name: 'Sans échéance', order: 2 },
    ],
    ...overrides,
  };
}

function build(options: { projects?: unknown[]; deliverables?: unknown[] } = {}) {
  const criteria: TaskInsightCriteria[] = [];

  const tasks: jest.Mocked<TaskInsightsLookup> = {
    findTasks: jest.fn().mockImplementation((received: TaskInsightCriteria) => {
      criteria.push(received);

      return Promise.resolve({
        items: [
          {
            id: new Types.ObjectId().toString(),
            title: 'Intégrer la page d’accueil',
            status: TaskStatus.IN_REVIEW,
            projectId: PROJECT_ID.toString(),
            assigneeId: ASSIGNEE_ID,
            dueDate: new Date('2026-08-03T00:00:00.000Z'),
          },
        ],
        total: 27,
      });
    }),
    workloadByAssignee: jest
      .fn()
      .mockResolvedValue([{ assigneeId: ASSIGNEE_ID, openTaskCount: 4, overdueTaskCount: 1 }]),
    progressByProject: jest
      .fn()
      .mockResolvedValue(new Map([[PROJECT_ID.toString(), { total: 4, done: 1, open: 3 }]])),
  };

  const projects = {
    findMany: jest.fn().mockResolvedValue(options.projects ?? [projectDocument()]),
    count: jest.fn().mockResolvedValue(1),
    accessibleProjectIds: jest.fn().mockResolvedValue([PROJECT_ID]),
  };

  const deliverables = {
    findMany: jest.fn().mockResolvedValue(options.deliverables ?? []),
    count: jest.fn().mockResolvedValue(0),
  };

  const users = {
    findByIds: jest.fn().mockResolvedValue(new Map([[ASSIGNEE_ID, { name: 'Sara Bennani' }]])),
  };

  const clients = {
    findNamesByIds: jest.fn().mockResolvedValue(new Map([[CLIENT_ID, 'NewDev SARL']])),
  };

  const service = new DashboardsService(
    projects as unknown as ProjectsRepository,
    deliverables as unknown as DeliverablesRepository,
    users as unknown as UsersRepository,
    clients as unknown as ClientsRepository,
    tasks,
  );

  return { service, tasks, projects, deliverables, users, criteria };
}

describe('the shape follows the role, and the role comes from the database', () => {
  it.each([
    [Role.ADMINISTRATOR],
    [Role.PROJECT_MANAGER],
    [Role.TEAM_MEMBER],
    [Role.CLIENT_CONTACT],
  ])('returns the %s dashboard', async (role) => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(role), NOW);

    expect(dashboard.role).toBe(role);
  });

  /**
   * ADR-0005 in one assertion. The caller sends no role and cannot: the
   * discriminant is read from the scope, which was rebuilt from the user record
   * on this request. A demoted Administrator gets the Team Member view on their
   * very next call rather than when the token expires.
   */
  it('takes the role from the scope, never from the request', async () => {
    const { service } = build();

    const demoted = await service.findForCurrentUser(scopeOf(Role.TEAM_MEMBER), NOW);

    expect(demoted.role).toBe(Role.TEAM_MEMBER);
    expect('teamWorkload' in demoted).toBe(false);
  });
});

describe('BR-28 — the client dashboard contains no internal work', () => {
  /**
   * Not "the tasks are filtered out" but "the questions are never asked". The
   * scope filter would refuse a Client Contact every task in the system anyway
   * (`TasksRepository.scopeFilter` returns `{ _id: null }` for them), so this
   * is the second of two independent guarantees — and the cheaper one to break
   * by accident, since adding a panel is a one-line change.
   */
  it('asks the task lookup for nothing at all', async () => {
    const { service, tasks } = build();

    await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    expect(tasks.findTasks).not.toHaveBeenCalled();
    expect(tasks.workloadByAssignee).not.toHaveBeenCalled();
  });

  /**
   * FR-033 against BR-28: a client sees no tasks and must still see progress.
   * `progressByProject` is the one task query their dashboard does make, and it
   * is deliberately unscoped for exactly this reason.
   */
  it('still computes project progress from the tasks it may not show', async () => {
    const { service, tasks } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    expect(tasks.progressByProject).toHaveBeenCalled();

    if (dashboard.role !== Role.CLIENT_CONTACT) throw new Error('wrong dashboard');

    expect(dashboard.projects.items[0].progress).toBe(25);
  });

  /**
   * OMITTED, not zeroed. `openTaskCount: 0` would be a statement about how much
   * work is outstanding — an internal figure the client is not entitled to, and
   * a misleading one at that.
   */
  it('omits the open-task count rather than sending a zero', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    if (dashboard.role !== Role.CLIENT_CONTACT) throw new Error('wrong dashboard');

    expect(dashboard.projects.items[0]).not.toHaveProperty('openTaskCount');
  });

  it('gives an internal role the count it is entitled to', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.PROJECT_MANAGER), NOW);

    if (dashboard.role !== Role.PROJECT_MANAGER) throw new Error('wrong dashboard');

    expect(dashboard.myProjects.items[0].openTaskCount).toBe(3);
  });
});

describe('FR-070, BR-26 — a Team Member sees their own work', () => {
  it('asks only for tasks assigned to the caller', async () => {
    const { service, criteria } = build();

    await service.findForCurrentUser(scopeOf(Role.TEAM_MEMBER), NOW);

    expect(criteria.length).toBeGreaterThan(0);
    // Every question, including both deadline alerts — an alert panel that
    // forgot the assignee would show the whole team's overdue work.
    expect(criteria.every((entry) => entry.assigneeId === USER_ID)).toBe(true);
  });

  /**
   * A board missing its "Bloquée" column reads as a rendering fault, not as
   * good news, so every column is present even when empty.
   */
  it('returns all four columns in board order, empty ones included', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.TEAM_MEMBER), NOW);

    if (dashboard.role !== Role.TEAM_MEMBER) throw new Error('wrong dashboard');

    expect(dashboard.tasksByStatus.map((group) => group.status)).toEqual([
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.IN_REVIEW,
      TaskStatus.BLOCKED,
    ]);
  });

  it('never asks for cancelled work in the deadline alerts', async () => {
    const { service, criteria } = build();

    await service.findForCurrentUser(scopeOf(Role.TEAM_MEMBER), NOW);

    const alerts = criteria.filter((entry) => entry.deadline);

    expect(alerts).toHaveLength(2);
    // A DONE or CANCELLED task is never late, whatever its date says.
    expect(
      alerts.every(
        (entry) =>
          !entry.statuses.includes(TaskStatus.DONE) &&
          !entry.statuses.includes(TaskStatus.CANCELLED),
      ),
    ).toBe(true);
  });
});

describe('FR-069 — the Project Manager dashboard leads with what waits on them', () => {
  /** BR-04: `IN_REVIEW` is the one status a Team Member cannot clear alone. */
  it('asks for tasks in review, and only those', async () => {
    const { service, criteria } = build();

    await service.findForCurrentUser(scopeOf(Role.PROJECT_MANAGER), NOW);

    expect(criteria).toContainEqual(expect.objectContaining({ statuses: [TaskStatus.IN_REVIEW] }));
  });

  it('asks for blocked tasks separately, so the reasons can be shown', async () => {
    const { service, criteria } = build();

    await service.findForCurrentUser(scopeOf(Role.PROJECT_MANAGER), NOW);

    expect(criteria).toContainEqual(expect.objectContaining({ statuses: [TaskStatus.BLOCKED] }));
  });

  /**
   * BR-25. The scope is resolved ONCE and the resolved copy is what every
   * query receives — an unresolved scope would make `TasksRepository` fail
   * closed and quietly return an empty dashboard.
   */
  it('resolves the accessible projects once and passes them down', async () => {
    const { service, projects, tasks } = build();

    await service.findForCurrentUser(scopeOf(Role.PROJECT_MANAGER), NOW);

    expect(projects.accessibleProjectIds).toHaveBeenCalledTimes(1);

    const [, passedScope] = tasks.findTasks.mock.calls[0];

    expect(passedScope.accessibleProjectIds).toEqual([PROJECT_ID.toString()]);
  });

  it('does not resolve a project list for an Administrator, who has no restriction', async () => {
    const { service, projects } = build();

    await service.findForCurrentUser(scopeOf(Role.ADMINISTRATOR), NOW);

    expect(projects.accessibleProjectIds).not.toHaveBeenCalled();
  });
});

describe('FR-068 — the Administrator sees the agency', () => {
  it('reports every project status, including the ones nobody is using', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.ADMINISTRATOR), NOW);

    if (dashboard.role !== Role.ADMINISTRATOR) throw new Error('wrong dashboard');

    // "0 en pause" is a figure. A status that vanished from the panel would
    // read as a missing feature rather than as an empty set.
    expect(Object.keys(dashboard.projectCountsByStatus).sort()).toEqual(
      Object.values(ProjectStatus).sort(),
    );
  });

  it('names the people in the workload panel', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.ADMINISTRATOR), NOW);

    if (dashboard.role !== Role.ADMINISTRATOR) throw new Error('wrong dashboard');

    expect(dashboard.teamWorkload).toEqual([
      { userId: ASSIGNEE_ID, name: 'Sara Bennani', openTaskCount: 4, overdueTaskCount: 1 },
    ]);
  });

  /** US-055 — overdue tasks are listed *with their project*. */
  it('attaches the project name to every overdue task', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.ADMINISTRATOR), NOW);

    if (dashboard.role !== Role.ADMINISTRATOR) throw new Error('wrong dashboard');

    expect(dashboard.overdueTasks.items[0].projectName).toBe('Refonte site vitrine');
    expect(dashboard.overdueTasks.items[0].assigneeName).toBe('Sara Bennani');
  });

  /**
   * The list is capped and the total is not. A truncated list that does not
   * admit it is truncated is worse than no list: the reader concludes there
   * are ten overdue tasks when there are twenty-seven.
   */
  it('reports the true total alongside the capped list', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.ADMINISTRATOR), NOW);

    if (dashboard.role !== Role.ADMINISTRATOR) throw new Error('wrong dashboard');

    expect(dashboard.overdueTasks.total).toBe(27);
    expect(dashboard.overdueTasks.items.length).toBeLessThan(dashboard.overdueTasks.total);
  });
});

describe('FR-071 — upcoming milestones', () => {
  it('lists only milestones still ahead, soonest first', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    if (dashboard.role !== Role.CLIENT_CONTACT) throw new Error('wrong dashboard');

    expect(dashboard.upcomingMilestones.items.map((milestone) => milestone.name)).toEqual([
      'Maquettes',
    ]);
  });

  /**
   * A milestone with no due date is not upcoming — it is undated, which is a
   * different statement and belongs on the project page.
   */
  it('excludes undated milestones rather than sorting them arbitrarily', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    if (dashboard.role !== Role.CLIENT_CONTACT) throw new Error('wrong dashboard');

    expect(
      dashboard.upcomingMilestones.items.some((milestone) => milestone.name === 'Sans échéance'),
    ).toBe(false);
  });

  it('carries the project name, since the list spans projects', async () => {
    const { service } = build();

    const dashboard = await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    if (dashboard.role !== Role.CLIENT_CONTACT) throw new Error('wrong dashboard');

    expect(dashboard.upcomingMilestones.items[0].projectName).toBe('Refonte site vitrine');
  });
});

describe('FR-071 — deliverables awaiting the client', () => {
  it('asks for both statuses that wait on the client (BR-31)', async () => {
    const { service, deliverables } = build();

    await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    // Starting the review is explicit, so a contact who never presses the
    // button must still see the work waiting for them.
    expect(deliverables.findMany).toHaveBeenCalledWith(
      { status: { $in: [DeliverableStatus.SUBMITTED, DeliverableStatus.UNDER_REVIEW] } },
      expect.anything(),
      expect.anything(),
    );
  });

  it('never returns a storage key', async () => {
    const { service } = build({
      deliverables: [
        {
          _id: new Types.ObjectId(),
          projectId: PROJECT_ID,
          name: 'Maquette page accueil',
          status: DeliverableStatus.SUBMITTED,
          currentVersionNumber: 1,
          versions: [
            {
              versionNumber: 1,
              submittedAt: new Date('2026-08-01T00:00:00.000Z'),
              files: [{ storageKey: 'agencyflow/deliverables/secret', originalName: 'a.pdf' }],
            },
          ],
        },
      ],
    });

    const dashboard = await service.findForCurrentUser(scopeOf(Role.CLIENT_CONTACT), NOW);

    if (dashboard.role !== Role.CLIENT_CONTACT) throw new Error('wrong dashboard');

    // ADR-0003 S-2. A dashboard is exactly the sort of convenience endpoint
    // where a spread of the document would smuggle the provider handle out.
    expect(JSON.stringify(dashboard)).not.toContain('storageKey');
    expect(JSON.stringify(dashboard)).not.toContain('secret');
  });
});
