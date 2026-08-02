import { Role } from '@agencyflow/contracts';
import type { AuthenticatedUser } from '@agencyflow/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { homePath, projectPath, projectsPath } from './routes';
import { RequireClientContact, RequireInternalRole } from '../components/shared/RequireAuth';
import { AuthProvider } from '../features/auth/AuthContext';

/**
 * The two route trees (09-Frontend-Design.md §1, §8.1).
 *
 * **These guards are not the security boundary.** The API refuses an
 * unauthorised call regardless of what the router says (NFR-20), and every
 * assertion here would still be a hole if the server did not. What they are is
 * the mechanism that keeps BR-28 visible in the URL — a client's portal has no
 * route to tasks or to the team roster — and that stops a stale bookmark from
 * dropping someone in a tree with no navigation back out.
 *
 * The redirect direction is what is worth testing. Getting it backwards would
 * produce an infinite redirect between the trees, which renders as a blank
 * page and is diagnosed slowly.
 */
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

function renderTrees(user: AuthenticatedUser, at: string) {
  sessionStorage.setItem('agencyflow.token', 'test-token');
  sessionStorage.setItem('agencyflow.user', JSON.stringify(user));

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path="/app" element={<RequireInternalRole />}>
              <Route path="projects" element={<p>espace agence</p>} />
              <Route path="dashboard" element={<p>tableau agence</p>} />
            </Route>

            <Route path="/portal" element={<RequireClientContact />}>
              <Route path="dashboard" element={<p>portail client</p>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.clearAllMocks());

describe('RequireInternalRole — the agency workspace', () => {
  it('lets agency staff in', () => {
    renderTrees(MANAGER, '/app/projects');

    expect(screen.getByText('espace agence')).toBeInTheDocument();
  });

  /**
   * A redirect and not a refusal, deliberately. `/app/projects` is not a page
   * a client is barred from so much as the wrong address for something they do
   * have — their portal lists their projects. Sending them there makes a stale
   * bookmark work instead of dead-ending.
   */
  it('sends a Client Contact to their own portal rather than refusing', () => {
    renderTrees(CLIENT, '/app/projects');

    expect(screen.getByText('portail client')).toBeInTheDocument();
    expect(screen.queryByText('espace agence')).not.toBeInTheDocument();
  });
});

describe('RequireClientContact — the portal', () => {
  it('lets a Client Contact in', () => {
    renderTrees(CLIENT, '/portal/dashboard');

    expect(screen.getByText('portail client')).toBeInTheDocument();
  });

  /**
   * The other direction. Together with the test above this proves the two
   * guards cannot bounce a user between them: each sends its unwanted visitor
   * to a destination the OTHER guard admits.
   */
  it('sends agency staff back to the workspace', () => {
    renderTrees(MANAGER, '/portal/dashboard');

    expect(screen.getByText('tableau agence')).toBeInTheDocument();
    expect(screen.queryByText('portail client')).not.toBeInTheDocument();
  });
});

describe('path helpers — one place decides which tree a link points into', () => {
  it('lands each role in their own tree', () => {
    expect(homePath(MANAGER)).toBe('/app/dashboard');
    expect(homePath(CLIENT)).toBe('/portal/dashboard');
  });

  it('keeps a project link inside the reader’s tree', () => {
    expect(projectPath(MANAGER, 'p-1')).toBe('/app/projects/p-1');
    expect(projectPath(CLIENT, 'p-1')).toBe('/portal/projects/p-1');
  });

  /**
   * A client has no project LIST route: their dashboard IS the list (FR-071).
   * "Back" pointing at `/portal/projects` would be a 404 inside their own
   * portal — the one place a user has every right to expect nothing to break.
   */
  it('sends a client back to their dashboard, not to a list they do not have', () => {
    expect(projectsPath(MANAGER)).toBe('/app/projects');
    expect(projectsPath(CLIENT)).toBe('/portal/dashboard');
  });

  /** Signed out, the safest assumption is the workspace, which then guards. */
  it('has a defined answer with no user', () => {
    expect(homePath(null)).toBe('/app/dashboard');
  });
});
