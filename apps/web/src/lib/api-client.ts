import type { ApiErrorResponse } from '@agencyflow/contracts';

/**
 * The single point through which the application talks to the API
 * (09-Frontend-Design.md section 3.2). No component calls `fetch` directly, so
 * there is exactly one place that attaches the token and normalises errors.
 */

/**
 * Origin of the API.
 *
 * Empty in development, where the Vite proxy makes the API same-origin. In
 * production Vercel serves the client and Render serves the API, so a relative
 * path would resolve against the Vercel domain and return `index.html` instead
 * of JSON — the failure looks like a JSON parse error and hides its own cause.
 *
 * The trailing slash is stripped so that both `https://host` and
 * `https://host/` produce the same request URL.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const API_BASE = `${API_ORIGIN}/api/v1`;

/** Thrown for any non-2xx response, carrying the API's error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ApiErrorResponse['details'],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /**
   * Drops the `/api/v1` prefix while keeping the API origin, for the
   * deliberately unversioned probes such as `/health`.
   */
  unversioned?: boolean;
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { body, unversioned, headers, ...rest } = options;

  const response = await fetch(`${unversioned ? API_ORIGIN : API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload as ApiErrorResponse | null;

    // 401 means the 12-hour session expired. Clearing the token here keeps
    // that decision in one place rather than in every caller.
    if (response.status === 401) {
      setAccessToken(null);
    }

    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `HTTP ${response.status}`,
      error?.details,
    );
  }

  return payload as TResponse;
}
