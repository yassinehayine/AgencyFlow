/**
 * Deliverable contracts (06-Database-Design.md section 7.5, SRS section 6.2).
 *
 * The client approval loop: a Project Manager submits, a client reviews and
 * either approves or asks for changes, and a change request produces a NEW
 * version rather than overwriting the old one (BR-06). Approval is terminal
 * and immutable (BR-07).
 */
import type { PaginationQuery } from './api.js';
import type { DeliverableStatus, VersionOutcome } from './enums.js';
import type { FileRefView } from './files.js';

export const DELIVERABLE_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 150,
  DESCRIPTION_MAX: 5000,
  DECISION_COMMENT_MIN: 3,
  DECISION_COMMENT_MAX: 2000,
  /** P-9 — bounded, which is what lets versions be embedded. */
  MAX_VERSIONS: 30,
  MAX_LINKED_TASKS: 50,
} as const;

/**
 * Permitted transitions (SRS §6.2).
 *
 * Reachability only. WHO may take each one is a separate question the service
 * answers: a Project Manager submits (BR-05) and only a Client Contact of the
 * owning organisation decides (BR-10). `APPROVED` is terminal — the empty
 * array is BR-07 expressed as data.
 */
export const DELIVERABLE_STATUS_TRANSITIONS: Readonly<
  Record<DeliverableStatus, readonly DeliverableStatus[]>
> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'CHANGES_REQUESTED'],
  UNDER_REVIEW: ['APPROVED', 'CHANGES_REQUESTED'],
  CHANGES_REQUESTED: ['SUBMITTED'],
  APPROVED: [],
} as const;

export interface DeliverableVersionView {
  versionNumber: number;
  files: FileRefView[];
  submittedAt?: string;
  submittedById?: string;
  outcome: VersionOutcome;
  decidedAt?: string;
  decidedById?: string;
  /** Present only when the outcome is `CHANGES_REQUESTED` (FR-049). */
  decisionComment?: string;
  createdAt: string;
}

export interface DeliverableSummary {
  id: string;
  projectId: string;
  name: string;
  status: DeliverableStatus;
  dueDate?: string;
  currentVersionNumber: number;
  /** Files on the CURRENT version only — the list view needs no history. */
  fileCount: number;
}

export interface DeliverableDetail extends DeliverableSummary {
  description?: string;
  /** FR-054 — the whole negotiation, oldest first. Append-only (BR-06). */
  versions: DeliverableVersionView[];
  linkedTaskIds: string[];
  reviewStartedAt?: string;
  approvedAt?: string;
  /** The client's formal acceptance record. */
  approvedById?: string;
  createdAt: string;
  updatedAt: string;
}

/** FR-045. `status` is absent — a new deliverable is always `DRAFT`. */
export interface CreateDeliverableRequest {
  name: string;
  description?: string;
  dueDate?: string;
}

/** FR-045. Refused entirely once approved (BR-07). */
export interface UpdateDeliverableRequest {
  name?: string;
  description?: string;
  dueDate?: string;
}

/** FR-049 — the comment is mandatory and must survive trimming. */
export interface RequestChangesRequest {
  comment: string;
}

export interface DeliverableListQuery extends PaginationQuery {
  projectId?: string;
  status?: DeliverableStatus;
}
