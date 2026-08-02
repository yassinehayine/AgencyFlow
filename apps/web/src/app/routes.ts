import { Role } from '@agencyflow/contracts';
import type { AuthenticatedUser } from '@agencyflow/contracts';

/**
 * The two route trees (09-Frontend-Design.md §1).
 *
 * `/app/*` is the internal workspace and `/portal/*` is the client portal.
 * Separate trees rather than one tree with conditionals, because it gives the
 * portal its own layout and its own responsive baseline (NFR-08) — and because
 * **the portal has no route to tasks, team or internal activity at all**. BR-28
 * is expressed as an absent route tree rather than as a hidden button.
 *
 * It is not the security mechanism. Every guard here can be defeated with dev
 * tools and it does not matter, because the API refuses independently (NFR-20).
 *
 * These helpers exist so that "where does a client go when they click a
 * project" is answered once. Scattering `user.role === CLIENT_CONTACT ? … : …`
 * across the components is how one link eventually points into the wrong tree
 * and drops someone on a redirect loop.
 */

export const APP_ROOT = '/app';
export const PORTAL_ROOT = '/portal';

export function isClientContact(user: AuthenticatedUser | null): boolean {
  return user?.role === Role.CLIENT_CONTACT;
}

/** Where a session lands after login, and what `/` redirects to. */
export function homePath(user: AuthenticatedUser | null): string {
  return isClientContact(user) ? `${PORTAL_ROOT}/dashboard` : `${APP_ROOT}/dashboard`;
}

export function projectPath(user: AuthenticatedUser | null, projectId: string): string {
  return isClientContact(user)
    ? `${PORTAL_ROOT}/projects/${projectId}`
    : `${APP_ROOT}/projects/${projectId}`;
}

/**
 * Where "back" goes from a project.
 *
 * A client has no project LIST route — their dashboard is the list (FR-071),
 * so sending them to `/portal/projects` would be a 404 in their own portal.
 */
export function projectsPath(user: AuthenticatedUser | null): string {
  return isClientContact(user) ? `${PORTAL_ROOT}/dashboard` : `${APP_ROOT}/projects`;
}
