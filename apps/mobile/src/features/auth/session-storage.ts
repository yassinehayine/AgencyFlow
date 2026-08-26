import type { AuthenticatedUser } from '@agencyflow/contracts';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the session lives on a device.
 *
 * **`expo-secure-store`, not `AsyncStorage`.** The web client uses
 * `sessionStorage` so nothing outlives the browser session; React Native has
 * no equivalent, and `AsyncStorage` is a plaintext file that any rooted device
 * or backup extraction can read. SecureStore delegates to the iOS Keychain and
 * the Android Keystore, which is the only storage on a phone worth putting a
 * bearer token in (NFR-19).
 *
 * **The session survives closing the app**, up to the token's natural 12-hour
 * expiry — a deliberate difference from the web, recorded in ADR-0007. An
 * application that signed the user out every time it was backgrounded would be
 * unusable, and BR-13 bounds the token's lifetime, not the process's.
 *
 * Token and user are stored under separate keys rather than as one blob:
 * SecureStore limits a value's size, and a user record that grows later should
 * not risk pushing the token itself over the edge.
 */

const TOKEN_KEY = 'agencyflow.token';
const USER_KEY = 'agencyflow.user';

export interface StoredSession {
  token: string;
  user: AuthenticatedUser;
}

/**
 * Reads the stored session, or `null`.
 *
 * Any failure — corrupt JSON, a key the Keystore can no longer decrypt after
 * a restore onto another device — resolves to `null` rather than throwing.
 * The correct response to an unreadable session is to ask the user to sign in
 * again, not to crash on launch with no way back.
 */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const [token, rawUser] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);

    if (!token || !rawUser) {
      return null;
    }

    return { token, user: JSON.parse(rawUser) as AuthenticatedUser };
  } catch {
    // Deliberately swallowed, and the only place in this codebase where that
    // is right: there is no recovery to attempt and no user to inform yet.
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
}

/**
 * Clears both keys, and does so even if one of them fails.
 *
 * `allSettled` rather than `all`: a sign-out that removed the user record but
 * left the token because the second call rejected would leave a device holding
 * a usable credential for a session the user believes they ended.
 */
export async function clearSession(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
