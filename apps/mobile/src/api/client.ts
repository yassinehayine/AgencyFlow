import type { ApiErrorResponse } from '@agencyflow/contracts';

import { API_BASE } from '../config/env';
import { ApiError } from './errors';

/**
 * The single point through which the application talks to the API.
 *
 * No screen calls `fetch` directly, so there is exactly one place that attaches
 * the token, applies the timeout, and turns a failure into something a screen
 * can render.
 *
 * **Nothing here logs.** Not the token, not the request body, not the
 * response. A `console.log` of a request in development ends up in a release
 * build more often than anyone intends, and on a device those logs are
 * readable over USB. The token is write-only from this module's point of
 * view: it goes into a header and is never returned, formatted or inspected.
 */

/**
 * Held in memory, deliberately.
 *
 * The durable copy lives in the Keystore (`session-storage.ts`); this is the
 * working copy for the current process. Keeping the two separate means the
 * request path never touches secure storage — an async read on every call
 * would be both slow and a second place for the token to be handled.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * How long to wait before deciding the network is not going to answer.
 *
 * Generous. A phone on a weak mobile connection is slow in a way a desk
 * browser is not, and a timeout that fires early turns a slow success into a
 * false failure — the worst outcome, because the user retries and doubles the
 * load that was already struggling.
 */
const TIMEOUT_MS = 30_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Login is the one call made without a session. */
  anonymous?: boolean;
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { method = 'GET', body, anonymous = false } = options;

  // `AbortController` rather than `Promise.race`: racing leaves the request
  // running and its response to be parsed by nobody, which on a slow network
  // means holding a connection the user has already given up on.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(anonymous || !accessToken ? {} : { Authorization: `Bearer ${accessToken}` }),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (caught) {
    // `fetch` rejects for exactly two reasons here, and they are not the same
    // failure: an abort is our own timeout, anything else is the request never
    // reaching the server. Reporting both as "network" would tell a user to
    // check their connection when the server is simply slow.
    const aborted = caught instanceof Error && caught.name === 'AbortError';

    throw new ApiError({
      kind: aborted ? 'timeout' : 'network',
      status: 0,
      code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      // Deliberately not `caught.message`: platform network messages are
      // English, technical, and occasionally include the full URL.
      message: '',
    });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = payload as ApiErrorResponse | null;

    throw new ApiError({
      kind: 'api',
      status: response.status,
      code: envelope?.code ?? 'UNKNOWN_ERROR',
      // The API's message is already French and already specific to the rule
      // that was broken (08-Backend-Design §5). Rewording it here would be a
      // second copy of every business message, free to drift.
      message: envelope?.message ?? '',
      ...(envelope?.details ? { details: envelope.details } : {}),
    });
  }

  return payload as TResponse;
}
