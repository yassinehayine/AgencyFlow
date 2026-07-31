/**
 * Transport-level contracts shared by the API and the web client.
 * Shapes only — 08-Backend-Design.md sections 2.3 and 5.
 */

/**
 * The single error envelope returned for every failure (08-Backend-Design 5.1).
 *
 * `code` is stable and machine-readable; `message` is French and intended for
 * display (NFR-01). Stack traces, internal paths and database errors are never
 * included (NFR-23).
 */
export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  correlationId: string;
  timestamp: string;
  path: string;
  /** Field-level failures, present only for validation errors. */
  details?: ApiErrorDetail[];
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Query parameters accepted by every list endpoint (NFR-17). */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export const SortOrder = {
  ASC: 'asc',
  DESC: 'desc',
} as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

/** Envelope returned by every list endpoint. */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Pagination bounds. Enforced server-side so a client cannot request everything. */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** Liveness payload returned by the health endpoint. */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  dependencies: {
    database: DependencyStatus;
    storage: DependencyStatus;
  };
}

export const DependencyStatus = {
  UP: 'up',
  DOWN: 'down',
  UNKNOWN: 'unknown',
} as const;
export type DependencyStatus = (typeof DependencyStatus)[keyof typeof DependencyStatus];
