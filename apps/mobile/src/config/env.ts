import Constants from 'expo-constants';

/**
 * Where the API lives.
 *
 * This is the single most common way to lose an afternoon on a React Native
 * project, so it is worth being explicit about. **A phone is not the machine
 * running the API.** `http://localhost:3000` on a device means the device
 * itself, so every request fails with a bare "Network request failed" that
 * names nothing and suggests nothing.
 *
 * Two mechanisms, in order:
 *
 *   1. `EXPO_PUBLIC_API_URL` — explicit, and the ONLY one that exists in a
 *      production build, where there is no development server to ask.
 *   2. The Metro host — in development, Expo already knows the IP address the
 *      phone used to reach the bundler. The API runs on the same machine, so
 *      that address plus the API port is correct without anyone configuring
 *      anything.
 *
 * (2) is what makes `npm start` work on a real phone straight away. It is a
 * development convenience and nothing more: it is deliberately unavailable in
 * a release build, where guessing an address would be worse than refusing.
 */

/** The API port in local development, from the repository's `.env`. */
const DEV_API_PORT = 3000;

/**
 * `hostUri` is `192.168.1.10:8081` while the bundler is serving. Undefined in
 * any standalone build, which is exactly when we must not guess.
 */
function metroHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return null;
  }

  const [host] = hostUri.split(':');

  return host ? `http://${host}:${DEV_API_PORT}` : null;
}

function resolveApiOrigin(): string {
  // Trailing slashes are stripped so that `https://host` and `https://host/`
  // produce the same request URL — the same rule the web client applies.
  const explicit = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

  if (explicit) {
    return explicit;
  }

  const derived = metroHost();

  if (derived) {
    return derived;
  }

  // Louder than an empty string. A misconfigured build should say so at the
  // first request rather than issue requests to a relative path that cannot
  // resolve on a device.
  throw new Error(
    'API introuvable. Définissez EXPO_PUBLIC_API_URL avant de construire ' +
      "l'application (voir apps/mobile/README.md).",
  );
}

/**
 * Resolved once. The value cannot change while the app is running, and
 * re-deriving it per request would only add ways for two calls to disagree.
 */
export const API_ORIGIN = resolveApiOrigin();

/** Matches the API's URI versioning (00-Project-Foundation §12.5). */
export const API_BASE = `${API_ORIGIN}/api/v1`;

/**
 * `/health` sits OUTSIDE the version prefix by design, so the platform probe
 * survives an API version bump. The mobile client uses it for the same reason
 * the web status page does: to distinguish "the server is unreachable" from
 * "the server refused me".
 */
export const HEALTH_URL = `${API_ORIGIN}/health`;
