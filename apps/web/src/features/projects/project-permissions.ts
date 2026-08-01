import { PROJECT_STATUS_TRANSITIONS, Role } from '@agencyflow/contracts';
import type { AuthenticatedUser, ProjectDetail, ProjectStatus } from '@agencyflow/contracts';

/**
 * What the interface should OFFER. Never what it permits.
 *
 * Every rule here is enforced independently by the API (FR-003, NFR-20), and
 * deleting this file would change nothing about what a user can actually do.
 * It exists so the screen does not present actions that will come back 403 —
 * a button that always fails teaches users to distrust the whole interface.
 *
 * Keeping these as pure functions, separate from the components, is what makes
 * them testable without rendering anything.
 */

/**
 * FR-020 — the owning PM, or any Administrator.
 *
 * Ownership alone is deliberately NOT sufficient; the role must permit project
 * management as well. An earlier version returned true on id equality only,
 * which is wrong in a reachable case: an Administrator may demote a user to
 * Team Member while `projectManagerId` still points at them, and that user
 * would then have been offered edit controls the server refuses. Requiring
 * both closes it, and matches how the API decides (RolesGuard, then scope).
 */
export function canEditProject(user: AuthenticatedUser | null, project: ProjectDetail): boolean {
  if (!user || project.isArchived) {
    return false;
  }

  if (user.role === Role.ADMINISTRATOR) {
    return true;
  }

  return user.role === Role.PROJECT_MANAGER && project.projectManagerId === user.id;
}

/** FR-022 — Administrator only (BR-24). A PM cannot hand off, nor take over. */
export function canReassignManager(user: AuthenticatedUser | null): boolean {
  return user?.role === Role.ADMINISTRATOR;
}

/** FR-023, FR-024 — the same right as editing the project. */
export function canManageTeam(user: AuthenticatedUser | null, project: ProjectDetail): boolean {
  return canEditProject(user, project);
}

/** FR-019 */
export function canCreateProject(user: AuthenticatedUser | null): boolean {
  return user?.role === Role.ADMINISTRATOR || user?.role === Role.PROJECT_MANAGER;
}

/**
 * The statuses reachable from the current one (SRS §6.4).
 *
 * Read from the shared transition table rather than restated, so the buttons
 * on screen and the rule on the server cannot drift apart. An empty array is a
 * terminal status — `COMPLETED` and `CANCELLED` are records, not workspaces —
 * and the caller renders no controls rather than a disabled row of them.
 */
export function availableTransitions(
  user: AuthenticatedUser | null,
  project: ProjectDetail,
): readonly ProjectStatus[] {
  if (!canEditProject(user, project)) {
    return [];
  }

  return PROJECT_STATUS_TRANSITIONS[project.status];
}
