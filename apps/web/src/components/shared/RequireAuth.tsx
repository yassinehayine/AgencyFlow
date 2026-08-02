import type { Role } from '@agencyflow/contracts';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { homePath, isClientContact } from '../../app/routes';
import { useAuth } from '../../features/auth/AuthContext';
import { fr } from '../../i18n/fr';

/**
 * Route protection — convenience, never security.
 *
 * This decides what to RENDER. It does not decide what a user may do: the
 * server checks every request against the token independently, and it would
 * refuse an unauthorised call even if this component were deleted (FR-003,
 * NFR-20). Hiding a page a user cannot use is a courtesy; the guarantee lives
 * on the other side of the network.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // The intended destination travels with the redirect, so logging in
    // resumes where the user was going rather than dumping them on a default
    // page and making them navigate again.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/**
 * Narrows a branch of the route tree to specific roles.
 *
 * Renders a refusal rather than redirecting. A redirect would imply the page
 * does not exist; the honest answer to an authenticated user asking for a page
 * their role cannot use is that it exists and is not for them.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { hasRole } = useAuth();

  if (!hasRole(...roles)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {fr.auth.forbidden}
        </p>
      </main>
    );
  }

  return <Outlet />;
}

/**
 * Keeps each audience in its own tree (09-Frontend-Design.md §8.1).
 *
 * These two REDIRECT where `RequireRole` refuses, and the difference is
 * deliberate. Being told "not for you" is the honest answer when a page exists
 * for other people — `/app/users` is a real page a Project Manager may not
 * open. But `/app/projects` for a Client Contact is not a page they are barred
 * from so much as the wrong address for something they do have: their portal
 * has its own. Sending them there is more useful than a refusal, and it also
 * makes a stale bookmark work rather than dead-end.
 */
export function RequireInternalRole() {
  const { user } = useAuth();

  return isClientContact(user) ? <Navigate to={homePath(user)} replace /> : <Outlet />;
}

export function RequireClientContact() {
  const { user } = useAuth();

  return isClientContact(user) ? <Outlet /> : <Navigate to={homePath(user)} replace />;
}
