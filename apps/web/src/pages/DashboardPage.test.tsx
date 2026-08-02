import { DeliverableStatus, ProjectStatus, Role, TaskStatus } from '@agencyflow/contracts';
import type {
  AdministratorDashboard,
  AuthenticatedUser,
  ClientDashboard,
  DashboardResponse,
  DashboardTask,
  ProjectManagerDashboard,
  TeamMemberDashboard,
} from '@agencyflow/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';
import { PortalDashboardPage } from './PortalDashboardPage';
import { fr } from '../i18n/fr';

/**
 * FR-068 – FR-073.
 *
 * `apiRequest` is mocked rather than `useDashboard`, so the query layer, the
 * auth context and the whole component tree run for real. Mocking the hook
 * would prove the page renders a prop; mocking the network proves it renders
 * what the API actually sends.
 *
 * The dates are relative to a FROZEN clock. A test that used the real one
 * would classify its own fixtures differently depending on the day it ran,
 * and a suite that fails on Tuesdays teaches people to ignore it.
 */
const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/api-client')>('../lib/api-client');
  return { ...actual, apiRequest };
});

const NOW = new Date('2026-08-02T09:00:00.000Z');

const CLIENT: AuthenticatedUser = {
  id: 'cc-1',
  name: 'Karim Alaoui',
  username: 'karim.alaoui',
  email: 'karim@newdev.ma',
  role: Role.CLIENT_CONTACT,
  clientId: 'org-1',
};

const MANAGER: AuthenticatedUser = {
  id: 'pm-1',
  name: 'Salma Idrissi',
  username: 'salma.idrissi',
  email: 'salma@agencyflow.ma',
  role: Role.PROJECT_MANAGER,
};

const MEMBER: AuthenticatedUser = { ...MANAGER, id: 'tm-1', role: Role.TEAM_MEMBER };
const ADMIN: AuthenticatedUser = { ...MANAGER, id: 'ad-1', role: Role.ADMINISTRATOR };

const taskOf = (overrides: Partial<DashboardTask> = {}): DashboardTask => ({
  id: 't-1',
  title: 'Intégrer la page d’accueil',
  status: TaskStatus.IN_REVIEW,
  projectId: 'p-1',
  projectName: 'Refonte site NewDev',
  assigneeId: 'tm-1',
  assigneeName: 'Amine Benali',
  ...overrides,
});

const listOf = <TItem,>(items: TItem[], total = items.length) => ({ items, total });
const emptyAlerts = () => ({ dueSoon: listOf([]), overdue: listOf([]) });

const projectOf = () => ({
  id: 'p-1',
  name: 'Refonte site NewDev',
  clientName: 'NewDev Maroc',
  status: ProjectStatus.IN_PROGRESS,
  endDate: '2026-12-01T00:00:00.000Z',
  progress: 40,
});

async function renderDashboard(
  user: AuthenticatedUser,
  data: DashboardResponse,
  Page: typeof DashboardPage = DashboardPage,
) {
  sessionStorage.setItem('agencyflow.token', 'test-token');
  sessionStorage.setItem('agencyflow.user', JSON.stringify(user));

  apiRequest.mockImplementation((path: string) => {
    if (path === '/dashboard') return Promise.resolve(data);
    throw new Error(`unmocked request: ${path}`);
  });

  const { AuthProvider } = await import('../features/auth/AuthContext');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  apiRequest.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('the page renders the shape the server sent, not the role it remembers', () => {
  /**
   * The session says Project Manager; the response says Team Member. The page
   * must follow the RESPONSE — under ADR-0005 the server re-reads the user
   * every request, so a stale session is exactly the case where these two
   * disagree, and the server is the one that is right.
   */
  it('follows the response when the cached session disagrees', async () => {
    const teamMember: TeamMemberDashboard = {
      role: Role.TEAM_MEMBER,
      tasksByStatus: [{ status: TaskStatus.TODO, tasks: [taskOf()] }],
      alerts: emptyAlerts(),
      completedTaskCount: 3,
    };

    await renderDashboard(MANAGER, teamMember);

    expect(await screen.findByText(fr.dashboard.myWorkTitle)).toBeInTheDocument();
    expect(screen.queryByText(fr.dashboard.myDayTitle)).not.toBeInTheDocument();
  });
});

describe('FR-069 — the Project Manager dashboard leads with what waits on them', () => {
  const dashboard: ProjectManagerDashboard = {
    role: Role.PROJECT_MANAGER,
    myProjects: listOf([projectOf()]),
    awaitingMyReview: listOf([taskOf()]),
    awaitingClientResponse: listOf([]),
    blockedTasks: listOf([
      taskOf({
        id: 't-2',
        status: TaskStatus.BLOCKED,
        title: 'Configurer le domaine',
        blockedReason: 'En attente des accès DNS du client',
      }),
    ]),
    alerts: emptyAlerts(),
  };

  it('shows the review queue first', async () => {
    await renderDashboard(MANAGER, dashboard);

    expect(await screen.findByText(fr.dashboard.awaitingMyReview)).toBeInTheDocument();
    expect(screen.getByText('Intégrer la page d’accueil')).toBeInTheDocument();
  });

  /** US-056 — "blocked tasks *with their reasons*". BR-22 makes the reason
      mandatory precisely so it can be shown here. */
  it('shows why a blocked task is blocked', async () => {
    await renderDashboard(MANAGER, dashboard);

    expect(await screen.findByText(/En attente des accès DNS du client/)).toBeInTheDocument();
  });

  it('names the project on every cross-project row', async () => {
    await renderDashboard(MANAGER, dashboard);

    // US-055/056 — an id is not an answer to "where is this?".
    expect(await screen.findAllByText(/Refonte site NewDev/)).not.toHaveLength(0);
  });
});

describe('FR-072 — deadline badges agree with the lists they sit in', () => {
  const withDeadlines: TeamMemberDashboard = {
    role: Role.TEAM_MEMBER,
    tasksByStatus: [
      {
        status: TaskStatus.TODO,
        tasks: [
          taskOf({ id: 'late', title: 'Tâche en retard', dueDate: '2026-07-30T00:00:00.000Z' }),
          taskOf({ id: 'soon', title: 'Tâche bientôt due', dueDate: '2026-08-04T00:00:00.000Z' }),
          taskOf({ id: 'later', title: 'Tâche plus tard', dueDate: '2026-09-15T00:00:00.000Z' }),
          taskOf({
            id: 'today',
            title: 'Tâche due aujourd’hui',
            dueDate: '2026-08-02T00:00:00.000Z',
          }),
        ],
      },
    ],
    alerts: emptyAlerts(),
    completedTaskCount: 0,
  };

  it('marks overdue and due-soon work, and leaves the rest plain', async () => {
    await renderDashboard(MEMBER, withDeadlines);

    await screen.findByText('Tâche en retard');

    // Matched with the separator, so these count BADGES and not the panel
    // headings that carry the same words — the alert panels are on this page
    // too, and a bare `/En retard/` would count one of them as a badge.
    const badges = (label: string) => screen.getAllByText(new RegExp(`${label} ·`));

    // The badge uses the same `classifyDeadline` the API turns into its date
    // range, so a row cannot carry a label its own list contradicts.
    expect(badges(fr.dashboard.overdue)).toHaveLength(1);
    // Due soon: tomorrow AND today — a task due today is due by the END of
    // today, so at 09:00 it is not late.
    expect(badges(fr.dashboard.dueSoon)).toHaveLength(2);
    // September is neither, and gets no badge at all: a green "on track" on
    // every dated row would bury the two that matter.
    expect(screen.getByText('15/09/2026')).toBeInTheDocument();
  });
});

describe('FR-068 — the Administrator dashboard', () => {
  const dashboard: AdministratorDashboard = {
    role: Role.ADMINISTRATOR,
    projectCountsByStatus: {
      PLANNED: 2,
      IN_PROGRESS: 5,
      ON_HOLD: 0,
      COMPLETED: 9,
      CANCELLED: 1,
    },
    activeProjects: listOf([projectOf()]),
    teamWorkload: [{ userId: 'tm-1', name: 'Amine Benali', openTaskCount: 4, overdueTaskCount: 2 }],
    overdueTasks: listOf([taskOf({ dueDate: '2026-07-20T00:00:00.000Z' })], 27),
    awaitingClientApproval: listOf([]),
  };

  it('shows a status nobody is using rather than dropping it', async () => {
    await renderDashboard(ADMIN, dashboard);

    // "0 en pause" is a figure. A vanished status reads as a missing feature.
    expect(await screen.findByText(fr.projectStatus.ON_HOLD)).toBeInTheDocument();
  });

  /**
   * A truncated list that does not admit it is truncated is worse than no
   * list: the reader concludes there are ten overdue tasks when there are 27.
   */
  it('admits when a list is capped', async () => {
    await renderDashboard(ADMIN, dashboard);

    expect(await screen.findByText(fr.dashboard.showingOf(1, 27))).toBeInTheDocument();
  });

  it('flags who is carrying overdue work', async () => {
    await renderDashboard(ADMIN, dashboard);

    expect(await screen.findByText(fr.dashboard.overdueCount(2))).toBeInTheDocument();
  });
});

describe('FR-071, BR-28 — the client portal', () => {
  const dashboard: ClientDashboard = {
    role: Role.CLIENT_CONTACT,
    projects: listOf([projectOf()]),
    awaitingMyApproval: listOf([
      {
        id: 'd-1',
        name: 'Maquette page accueil',
        status: DeliverableStatus.SUBMITTED,
        projectId: 'p-1',
        projectName: 'Refonte site NewDev',
        currentVersionNumber: 2,
        submittedAt: '2026-08-01T00:00:00.000Z',
      },
    ]),
    recentlyApproved: listOf([]),
    upcomingMilestones: listOf([
      {
        id: 'm-1',
        name: 'Maquettes',
        projectId: 'p-1',
        projectName: 'Refonte site NewDev',
        dueDate: '2026-08-20T00:00:00.000Z',
      },
    ]),
  };

  /**
   * US-059 — "when I log in, then it is the most prominent item on the page".
   * Asserted as document ORDER, not as styling: on a 375 px screen the second
   * panel is already below the fold, so being first IS being prominent.
   */
  it('puts pending approvals above everything else', async () => {
    await renderDashboard(CLIENT, dashboard, PortalDashboardPage);

    const headings = await screen.findAllByRole('heading', { level: 2 });

    expect(headings[0]).toHaveTextContent(fr.dashboard.awaitingMyApproval);
  });

  it('shows progress on each project (FR-033, PG-04)', async () => {
    await renderDashboard(CLIENT, dashboard, PortalDashboardPage);

    expect(await screen.findByText(/40%/)).toBeInTheDocument();
  });

  /**
   * BR-28, on the client's side of the wire. There is no task panel because
   * `ClientDashboard` has no field to hold one — this asserts the rendered
   * consequence, and the type is what makes adding one a compile error.
   */
  it('shows no task board and no workload panel', async () => {
    await renderDashboard(CLIENT, dashboard, PortalDashboardPage);

    await screen.findByText(fr.dashboard.portalTitle);

    expect(screen.queryByText(fr.dashboard.workload)).not.toBeInTheDocument();
    expect(screen.queryByText(fr.dashboard.awaitingMyReview)).not.toBeInTheDocument();
    expect(screen.queryByText(fr.taskStatus.IN_REVIEW)).not.toBeInTheDocument();
  });

  it('lists upcoming milestones with the project they belong to', async () => {
    await renderDashboard(CLIENT, dashboard, PortalDashboardPage);

    expect(await screen.findByText('Maquettes')).toBeInTheDocument();
  });

  /**
   * The portal renders a client dashboard and nothing else. The route guard
   * decides what mounts; this decides what may be READ, and only one of the
   * two survives somebody rearranging the router.
   */
  it('refuses to render an internal dashboard even if one arrives', async () => {
    const wrongShape: AdministratorDashboard = {
      role: Role.ADMINISTRATOR,
      projectCountsByStatus: {
        PLANNED: 1,
        IN_PROGRESS: 1,
        ON_HOLD: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      },
      activeProjects: listOf([projectOf()]),
      teamWorkload: [
        { userId: 'tm-1', name: 'Amine Benali', openTaskCount: 4, overdueTaskCount: 0 },
      ],
      overdueTasks: listOf([taskOf()]),
      awaitingClientApproval: listOf([]),
    };

    await renderDashboard(CLIENT, wrongShape, PortalDashboardPage);

    expect(await screen.findByText(fr.dashboard.empty)).toBeInTheDocument();
    expect(screen.queryByText('Amine Benali')).not.toBeInTheDocument();
  });
});
