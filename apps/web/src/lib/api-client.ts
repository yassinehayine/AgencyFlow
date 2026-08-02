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

/**
 * Multipart upload (FR-046).
 *
 * Separate from `apiRequest` because the `Content-Type` must be left UNSET:
 * the browser generates `multipart/form-data` together with the boundary, and
 * setting the header by hand omits the boundary and produces a body the server
 * cannot parse. Sharing the helper and "just" overriding the header is exactly
 * how that bug gets introduced.
 */
export async function apiUpload<TResponse>(path: string, file: File): Promise<TResponse> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload as ApiErrorResponse | null;

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

/**
 * Fetches a file and hands it to the browser (FR-056).
 *
 * There is no URL to link to. Downloads are proxied through the API so the
 * permission check runs every time (ADR-0003 S-2), which means the request
 * needs the bearer token — and an `<a href>` cannot carry one. So the bytes
 * are fetched, wrapped in an object URL, and clicked programmatically.
 *
 * The object URL is revoked immediately after; leaking one pins the whole file
 * in memory for the life of the tab.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorResponse | null;

    if (response.status === 401) {
      setAccessToken(null);
    }

    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `HTTP ${response.status}`,
    );
  }

  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
