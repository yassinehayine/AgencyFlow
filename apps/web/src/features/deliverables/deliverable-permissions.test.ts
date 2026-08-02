import { DeliverableStatus, Role, VersionOutcome } from '@agencyflow/contracts';
import type {
  AuthenticatedUser,
  DeliverableDetail,
  DeliverableStatus as Status,
} from '@agencyflow/contracts';
import { describe, expect, it } from 'vitest';

import {
  canAuthor,
  canDecide,
  canStartReview,
  canSubmit,
  isFinal,
} from './deliverable-permissions';

const userOf = (role: Role): AuthenticatedUser => ({
  id: 'u-1',
  name: 'Test',
  username: 'test.user',
  email: 'test@agencyflow.ma',
  role,
});

const MANAGER = userOf(Role.PROJECT_MANAGER);
const ADMIN = userOf(Role.ADMINISTRATOR);
const MEMBER = userOf(Role.TEAM_MEMBER);
const CLIENT = userOf(Role.CLIENT_CONTACT);

function deliverableOf(status: Status, fileCount = 1): DeliverableDetail {
  return {
    id: 'd-1',
    projectId: 'p-1',
    name: 'Maquette page accueil',
    status,
    currentVersionNumber: 1,
    fileCount,
    versions: [
      {
        versionNumber: 1,
        files: Array.from({ length: fileCount }, (_unused, index) => ({
          id: `f-${index}`,
          originalName: 'maquette.pdf',
          extension: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedById: 'u-1',
          uploadedAt: '2026-08-01T00:00:00.000Z',
        })),
        outcome: VersionOutcome.PENDING,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    linkedTaskIds: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('BR-07 — approval ends everything', () => {
  it('reports an approved deliverable as final', () => {
    expect(isFinal(deliverableOf(DeliverableStatus.APPROVED))).toBe(true);
  });

  it.each([MANAGER, ADMIN])('offers no authoring on an approved deliverable', (user) => {
    expect(canAuthor(user, deliverableOf(DeliverableStatus.APPROVED))).toBe(false);
    expect(canSubmit(user, deliverableOf(DeliverableStatus.APPROVED))).toBe(false);
  });

  it('offers the client no further decision either', () => {
    expect(canDecide(CLIENT, deliverableOf(DeliverableStatus.APPROVED))).toBe(false);
    expect(canStartReview(CLIENT, deliverableOf(DeliverableStatus.APPROVED))).toBe(false);
  });
});

describe('BR-05 — the agency prepares', () => {
  it.each([MANAGER, ADMIN])('offers authoring to a manager', (user) => {
    expect(canAuthor(user, deliverableOf(DeliverableStatus.DRAFT))).toBe(true);
  });

  it.each([MEMBER, CLIENT])('offers authoring to nobody else', (user) => {
    expect(canAuthor(user, deliverableOf(DeliverableStatus.DRAFT))).toBe(false);
    expect(canSubmit(user, deliverableOf(DeliverableStatus.DRAFT))).toBe(false);
  });

  /** FR-047 — a submission with nothing attached asks the client for nothing. */
  it('does not offer submission with no file attached', () => {
    expect(canSubmit(MANAGER, deliverableOf(DeliverableStatus.DRAFT, 0))).toBe(false);
    expect(canSubmit(MANAGER, deliverableOf(DeliverableStatus.DRAFT, 1))).toBe(true);
  });

  it('offers resubmission after a change request', () => {
    expect(canSubmit(MANAGER, deliverableOf(DeliverableStatus.CHANGES_REQUESTED, 1))).toBe(true);
  });

  it('does not offer submission twice', () => {
    expect(canSubmit(MANAGER, deliverableOf(DeliverableStatus.SUBMITTED))).toBe(false);
  });
});

describe('FR-048 — the client decides, and nobody else', () => {
  /**
   * The asymmetry the whole feature rests on. An Administrator is refused as
   * firmly as a Team Member: an approval the agency could grant itself would
   * be worthless as an acceptance record.
   */
  it.each([MANAGER, ADMIN, MEMBER])('offers no decision to agency staff', (user) => {
    expect(canDecide(user, deliverableOf(DeliverableStatus.SUBMITTED))).toBe(false);
    expect(canStartReview(user, deliverableOf(DeliverableStatus.SUBMITTED))).toBe(false);
  });

  it('offers a decision to the client once submitted', () => {
    expect(canDecide(CLIENT, deliverableOf(DeliverableStatus.SUBMITTED))).toBe(true);
  });

  it('offers a decision while under review too', () => {
    expect(canDecide(CLIENT, deliverableOf(DeliverableStatus.UNDER_REVIEW))).toBe(true);
  });

  it('offers no decision on a draft the client should not even see acted on', () => {
    expect(canDecide(CLIENT, deliverableOf(DeliverableStatus.DRAFT))).toBe(false);
  });
});

describe('FR-081 — starting the review is explicit and one-way', () => {
  it('is offered from SUBMITTED', () => {
    expect(canStartReview(CLIENT, deliverableOf(DeliverableStatus.SUBMITTED))).toBe(true);
  });

  /** Already under review — the action has been taken. */
  it('is not offered again once under review', () => {
    expect(canStartReview(CLIENT, deliverableOf(DeliverableStatus.UNDER_REVIEW))).toBe(false);
  });

  it('is not offered on a draft', () => {
    expect(canStartReview(CLIENT, deliverableOf(DeliverableStatus.DRAFT))).toBe(false);
  });
});
