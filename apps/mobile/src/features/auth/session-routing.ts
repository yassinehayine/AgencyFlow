import { Role } from '@agencyflow/contracts';
import type { AuthenticatedUser } from '@agencyflow/contracts';

/**
 * Where a given session belongs — as a pure function.
 *
 * Extracted from the layouts deliberately. Redirect decisions are the one part
 * of navigation that fails catastrophically rather than visibly: get the two
 * directions the wrong way round and each guard bounces the user to the other,
 * which renders as a blank screen with no error and is diagnosed slowly. The
 * web client has a test suite for exactly this reason
 * (`apps/web/src/app/router.test.tsx`).
 *
 * Keeping it free of React and of `expo-router` means it can be tested without
 * a renderer when the mobile test runner arrives in Phase 10.
 */

export const ROUTES = {
  login: '/(auth)/login',
  dashboard: '/(portal)/dashboard',
} as const;

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Whether this account may use the mobile application at all.
 *
 * **The portal is for Client Contacts** (ADR-0007). An agency account is not
 * refused because it is untrusted — it is refused because nothing here is
 * built for it: no task board, no user administration, no project authoring.
 * Signing a Project Manager in would strand them on a dashboard describing
 * projects they cannot act on.
 *
 * This is a usability boundary, not a security one. The API applies BR-10 and
 * BR-28 to every request regardless of which client sent it.
 */
export function isPortalUser(user: AuthenticatedUser | null): boolean {
  return user?.role === Role.CLIENT_CONTACT;
}

/**
 * The destination for a session in a given state, or `null` to stay put.
 *
 * `null` matters as much as the redirects: returning a route unconditionally
 * would re-navigate on every render, and a layout that redirects to the screen
 * it is already showing is an infinite loop.
 */
export function redirectFor(
  status: SessionStatus,
  area: 'auth' | 'portal',
): (typeof ROUTES)[keyof typeof ROUTES] | null {
  // Nothing is known yet. Redirecting now would flash the login screen at a
  // user who is already signed in, because reading the Keystore is async.
  if (status === 'loading') {
    return null;
  }

  if (area === 'portal' && status === 'unauthenticated') {
    return ROUTES.login;
  }

  if (area === 'auth' && status === 'authenticated') {
    return ROUTES.dashboard;
  }

  return null;
}
