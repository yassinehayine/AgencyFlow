/**
 * Client organisation contracts (06-Database-Design.md section 7.2).
 *
 * A Client is an ORGANISATION, not a person (BR-09). The people are
 * `CLIENT_CONTACT` users pointing at it, which is what makes `clientId` a
 * usable isolation key: one organisation, many logins, one boundary (BR-10).
 */
import type { PaginationQuery } from './api.js';

export const CLIENT_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 150,
  ADDRESS_MAX: 300,
  NOTES_MAX: 2000,
} as const;

export interface ClientSummary {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  /**
   * Derived from `archivedAt`, not stored twice. Archived is neither deleted
   * nor inactive: the organisation is hidden from default lists and accepts
   * no new projects, while all its history stays reachable (06-DB 10.1).
   */
  isArchived: boolean;
}

export interface ClientDetail extends ClientSummary {
  address?: string;
  notes?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** FR-013. Name is required and unique among non-deleted organisations. */
export interface CreateClientRequest {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
}

/** FR-014. Every field optional; omitted means unchanged. */
export type UpdateClientRequest = Partial<CreateClientRequest>;

/** FR-015. */
export interface ClientListQuery extends PaginationQuery {
  /** Matches the organisation name. */
  search?: string;
  /**
   * Archived organisations are hidden unless asked for by name (FR-018).
   * The safe default is the quiet one; the wider view is explicit.
   */
  includeArchived?: boolean;
}
