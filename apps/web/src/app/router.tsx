import { Role } from '@agencyflow/contracts';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '../components/layout/AppLayout';
import { PortalLayout } from '../components/layout/PortalLayout';
import {
  RequireAuth,
  RequireClientContact,
  RequireInternalRole,
  RequireRole,
} from '../components/shared/RequireAuth';
import { ClientsPage } from '../pages/ClientsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LandingRedirect } from '../pages/LandingRedirect';
import { PortalDashboardPage } from '../pages/PortalDashboardPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { LoginPage } from '../pages/LoginPage';
import { SystemStatusPage } from '../pages/SystemStatusPage';
import { UsersPage } from '../pages/UsersPage';

/**
 * The route map (09-Frontend-Design.md §1).
 *
 * **Two trees, one bundle.** `/app/*` is the agency's workspace and
 * `/portal/*` is the client's. The split is what makes BR-28 visible in the
 * URL: the portal has no route to tasks, to the team roster, or to internal
 * activity — not a hidden link, an absent branch. It also lets each tree carry
 * its own layout, which is the whole reason the portal can be built for a
 * phone (NFR-08, FR-073) without compromising the dense internal screens.
 *
 * Protection is expressed by NESTING rather than by a guard on each route, so
 * adding a page inside a branch cannot accidentally be public or accidentally
 * cross trees — the mistake would have to be made deliberately, by putting the
 * route somewhere else.
 *
 * Every guard here is a convenience. The API refuses an unauthorised call
 * regardless of what this file says (FR-003, NFR-20).
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  {
    element: <RequireAuth />,
    children: [
      // `/` is a redirect, not a page: which tree you belong to is a fact
      // about you, so the answer is computed rather than chosen.
      { index: true, element: <LandingRedirect /> },

      // --- The agency workspace ------------------------------------------
      {
        path: 'app',
        element: <RequireInternalRole />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/app/dashboard" replace /> },

              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'projects', element: <ProjectsPage /> },
              { path: 'projects/:id', element: <ProjectDetailPage /> },
              { path: 'status', element: <SystemStatusPage /> },

              {
                element: <RequireRole roles={[Role.ADMINISTRATOR]} />,
                children: [{ path: 'users', element: <UsersPage /> }],
              },

              {
                element: <RequireRole roles={[Role.ADMINISTRATOR, Role.PROJECT_MANAGER]} />,
                children: [{ path: 'clients', element: <ClientsPage /> }],
              },
            ],
          },
        ],
      },

      // --- The client portal ---------------------------------------------
      {
        path: 'portal',
        element: <RequireClientContact />,
        children: [
          {
            element: <PortalLayout />,
            children: [
              { index: true, element: <Navigate to="/portal/dashboard" replace /> },

              { path: 'dashboard', element: <PortalDashboardPage /> },
              // No project LIST route: the dashboard is the list (FR-071).
              { path: 'projects/:id', element: <ProjectDetailPage /> },
            ],
          },
        ],
      },
    ],
  },

  // An unknown path lands on `/`, which then routes by role — so a stale
  // bookmark into the other tree ends up somewhere the user can actually use
  // rather than on a dead end.
  { path: '*', element: <Navigate to="/" replace /> },
]);
