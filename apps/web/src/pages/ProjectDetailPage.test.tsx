import { ProjectStatus, Role, Skill } from '@agencyflow/contracts';
import type { AuthenticatedUser, ProjectDetail } from '@agencyflow/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectDetailPage } from './ProjectDetailPage';
import { fr } from '../i18n/fr';

/**
 * Renders the real page against a stubbed transport.
 *
 * `apiRequest` is mocked rather than `useProject`, so the component tree, the
 * query layer and the auth context all run for real. Mocking the hook would
 * test that the page renders a prop — mocking the network tests that it
 * renders what the API actually returns.
 */
const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/api-client')>('../lib/api-client');
  return { ...actual, apiRequest };
});

const CLIENT_USER: AuthenticatedUser = {
  id: 'cc-1',
  name: 'Karim Alaoui',
  username: 'karim.alaoui',
  email: 'karim@newdev.ma',
  role: Role.CLIENT_CONTACT,
  clientId: 'org-1',
};

const OWNER: AuthenticatedUser = {
  id: 'pm-1',
  name: 'Salma Idrissi',
  username: 'salma.idrissi',
  email: 'salma@agencyflow.ma',
  role: Role.PROJECT_MANAGER,
};

function projectOf(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: 'project-1',
    name: 'Refonte site NewDev',
    clientId: 'org-1',
    clientName: 'NewDev Maroc',
    projectManagerId: 'pm-1',
    projectManagerName: 'Salma Idrissi',
    status: ProjectStatus.PLANNED,
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2026-12-01T00:00:00.000Z',
    isArchived: false,
    teamSize: 1,
    milestoneCount: 0,
    milestones: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Signs the given user in the way the application does — through
 * sessionStorage — so `AuthProvider` restores them on first render.
 */
async function renderAs(user: AuthenticatedUser, project: ProjectDetail) {
  sessionStorage.setItem('agencyflow.token', 'test-token');
  sessionStorage.setItem('agencyflow.user', JSON.stringify(user));

  apiRequest.mockImplementation((path: string) => {
    if (path.startsWith('/projects/')) return Promise.resolve(project);
    if (path.startsWith('/users')) return Promise.resolve({ items: [], page: 1, totalPages: 1 });
    if (path.startsWith('/tasks') || path.startsWith('/deliverables'))
      return Promise.resolve({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 1 });
    // Answering explicitly rather than falling through to null: an unhandled
    // path used to resolve `null`, and the page only survived because the
    // assertions happened to run while that query was still pending.
    throw new Error(`unmocked request: ${path}`);
  });

  const { AuthProvider } = await import('../features/auth/AuthContext');

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/projects/project-1']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProjectDetailPage — BR-28, the roster is internal', () => {
  const withTeam = projectOf({
    team: [
      {
        user: {
          id: 'tm-1',
          name: 'Amine Benali',
          username: 'amine.benali',
          email: 'amine@agencyflow.ma',
          role: Role.TEAM_MEMBER,
          skill: Skill.BACKEND,
          isActive: true,
        },
        addedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  });

  it('shows the roster to agency staff', async () => {
    await renderAs(OWNER, withTeam);

    expect(await screen.findByText('Amine Benali')).toBeInTheDocument();
  });

  /**
   * The API omits `team` entirely for a Client Contact rather than sending an
   * empty array, so the page can say the roster is internal instead of
   * implying nobody is assigned. Both halves are asserted: the name must be
   * absent AND the explanation present.
   */
  it('tells a Client Contact the roster is internal, and names nobody', async () => {
    await renderAs(CLIENT_USER, projectOf());

    expect(await screen.findByText(fr.projects.teamHiddenForClient)).toBeInTheDocument();
    expect(screen.queryByText('Amine Benali')).not.toBeInTheDocument();
  });
});

describe('ProjectDetailPage — FR-021 transitions', () => {
  it('offers the owning manager only the reachable statuses', async () => {
    await renderAs(OWNER, projectOf({ status: ProjectStatus.PLANNED }));

    expect(await screen.findByText(/En cours/)).toBeInTheDocument();
    expect(screen.getByText(/En pause/)).toBeInTheDocument();
    // COMPLETED is not reachable from PLANNED.
    expect(screen.queryByText(/Faire passer à « Terminé »/)).not.toBeInTheDocument();
  });

  it('offers a Client Contact no status controls at all', async () => {
    await renderAs(CLIENT_USER, projectOf({ status: ProjectStatus.PLANNED }));

    await screen.findByText(fr.projects.teamHiddenForClient);
    expect(screen.queryByText(/Faire passer à/)).not.toBeInTheDocument();
  });

  it('explains a terminal status instead of showing dead buttons', async () => {
    await renderAs(OWNER, projectOf({ status: ProjectStatus.COMPLETED }));

    expect(await screen.findByText(fr.projects.noTransitions)).toBeInTheDocument();
  });
});

describe('ProjectDetailPage — BR-28, tasks are internal', () => {
  /**
   * The panel must not be MOUNTED for a client, not merely emptied. A mounted
   * panel would issue GET /tasks, which the API answers 403 — a request the
   * client should never have made.
   */
  it('does not request tasks at all for a Client Contact', async () => {
    await renderAs(CLIENT_USER, projectOf());

    await screen.findByText(fr.projects.teamHiddenForClient);

    const paths = apiRequest.mock.calls.map((call) => String(call[0]));
    expect(paths.some((path) => path.startsWith('/tasks'))).toBe(false);
  });

  it('requests them for agency staff', async () => {
    await renderAs(OWNER, projectOf());

    await screen.findByText(/Refonte site NewDev/);

    await vi.waitFor(() => {
      const paths = apiRequest.mock.calls.map((call) => String(call[0]));
      expect(paths.some((path) => path.startsWith('/tasks'))).toBe(true);
    });
  });
});

describe('ProjectDetailPage — FR-052, deliverables are the client-facing half', () => {
  /**
   * The deliberate contrast with tasks. A Client Contact is shown no task
   * panel at all (BR-28) but MUST see deliverables — the approval loop is the
   * entire reason they have an account.
   */
  it('requests deliverables for a Client Contact, and tasks for nobody', async () => {
    await renderAs(CLIENT_USER, projectOf());

    await screen.findByText(fr.projects.teamHiddenForClient);

    await vi.waitFor(() => {
      const paths = apiRequest.mock.calls.map((call) => String(call[0]));
      expect(paths.some((path) => path.startsWith('/deliverables'))).toBe(true);
      expect(paths.some((path) => path.startsWith('/tasks'))).toBe(false);
    });
  });
});
