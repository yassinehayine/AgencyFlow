import { Role } from '@agencyflow/contracts';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '../components/layout/AppLayout';
import { RequireAuth, RequireRole } from '../components/shared/RequireAuth';
import { ClientsPage } from '../pages/ClientsPage';
import { LoginPage } from '../pages/LoginPage';
import { SystemStatusPage } from '../pages/SystemStatusPage';
import { UsersPage } from '../pages/UsersPage';

/**
 * The route map (09-Frontend-Design.md section 2).
 *
 * Protection is expressed by NESTING rather than by a guard on each route.
 * Everything under `RequireAuth` is authenticated because of where it sits, so
 * adding a page inside that branch cannot accidentally be public — the mistake
 * would have to be made deliberately, by putting the route somewhere else.
 *
 * Role branches mirror the permission matrix (SRS section 8) and are a
 * convenience only: the API refuses an unauthorised call regardless of what
 * this file says (FR-003, NFR-20).
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/status" replace /> },

          { path: '/status', element: <SystemStatusPage /> },

          {
            element: <RequireRole roles={[Role.ADMINISTRATOR]} />,
            children: [{ path: '/users', element: <UsersPage /> }],
          },

          {
            element: <RequireRole roles={[Role.ADMINISTRATOR, Role.PROJECT_MANAGER]} />,
            children: [{ path: '/clients', element: <ClientsPage /> }],
          },
        ],
      },
    ],
  },

  // Unknown paths land on the entry point rather than a dead end. A dedicated
  // 404 page belongs with the slice that gives the application enough surface
  // for a wrong URL to be a plausible mistake.
  { path: '*', element: <Navigate to="/" replace /> },
]);
