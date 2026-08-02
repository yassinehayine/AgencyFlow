import { DELIVERABLE_STATUS_TRANSITIONS, Role } from '@agencyflow/contracts';
import type { AuthenticatedUser, DeliverableDetail } from '@agencyflow/contracts';

/**
 * Which deliverable actions to OFFER. Never which are permitted.
 *
 * The API enforces BR-05, BR-07 and FR-048 independently. This exists so the
 * screen does not show a client an "Approuver" button on a draft, or show the
 * agency an approval button it can never use.
 *
 * The asymmetry is the whole point of the feature and is expressed directly
 * here: **the agency prepares, the client decides.** Neither side can do the
 * other's half, and an Administrator is no exception — an approval the agency
 * could grant itself would be worthless as an acceptance record.
 */

const isManager = (user: AuthenticatedUser | null): boolean =>
  user?.role === Role.ADMINISTRATOR || user?.role === Role.PROJECT_MANAGER;

const isClient = (user: AuthenticatedUser | null): boolean => user?.role === Role.CLIENT_CONTACT;

/** BR-07 — approval ends every write, not just the transitions. */
export function isFinal(deliverable: DeliverableDetail): boolean {
  return deliverable.status === 'APPROVED';
}

/** FR-045, FR-046 — the agency side. */
export function canAuthor(user: AuthenticatedUser | null, deliverable: DeliverableDetail): boolean {
  return isManager(user) && !isFinal(deliverable);
}

/**
 * FR-047, BR-05 — submit.
 *
 * Requires at least one file on the current version. Checking it here means
 * the button is disabled with a reason rather than returning a 422 that the
 * user has to interpret.
 */
export function canSubmit(user: AuthenticatedUser | null, deliverable: DeliverableDetail): boolean {
  if (!canAuthor(user, deliverable)) {
    return false;
  }

  if (!DELIVERABLE_STATUS_TRANSITIONS[deliverable.status].includes('SUBMITTED')) {
    return false;
  }

  return currentVersionFileCount(deliverable) > 0;
}

/** FR-081 — the explicit client action, never a side effect of opening. */
export function canStartReview(
  user: AuthenticatedUser | null,
  deliverable: DeliverableDetail,
): boolean {
  return (
    isClient(user) && DELIVERABLE_STATUS_TRANSITIONS[deliverable.status].includes('UNDER_REVIEW')
  );
}

/** FR-048, FR-049 — only a Client Contact decides. */
export function canDecide(user: AuthenticatedUser | null, deliverable: DeliverableDetail): boolean {
  return isClient(user) && DELIVERABLE_STATUS_TRANSITIONS[deliverable.status].includes('APPROVED');
}

/** Files on the version currently open for work — never the whole history. */
export function currentVersionFileCount(deliverable: DeliverableDetail): number {
  const current = deliverable.versions.find(
    (version) => version.versionNumber === deliverable.currentVersionNumber,
  );

  return current ? current.files.length : 0;
}
