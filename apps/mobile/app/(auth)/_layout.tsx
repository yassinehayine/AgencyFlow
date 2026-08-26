import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '../../src/components/LoadingScreen';
import { useSession } from '../../src/features/auth/SessionContext';
import { redirectFor } from '../../src/features/auth/session-routing';

/**
 * `(auth)` — the unauthenticated area. Currently one screen.
 *
 * The group exists so that the guard is written once, in a layout, rather than
 * repeated at the top of each screen inside it. Adding a "forgotten password"
 * screen later means adding a file, not remembering a check.
 *
 * **It guards in the opposite direction to `(portal)`.** A signed-in user who
 * reaches the login screen — through a deep link, or by tapping back after
 * signing in — is sent to their dashboard rather than shown a form they have
 * no use for. The two guards must send their unwanted visitor to a destination
 * the OTHER guard admits, or they bounce the user between them forever; that
 * is why the decision is a single pure function both call.
 */
export default function AuthLayout() {
  const { status } = useSession();
  const destination = redirectFor(status, 'auth');

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (destination) {
    return <Redirect href={destination} />;
  }

  // `animation: none` because this stack is entered by redirect rather than by
  // a deliberate tap. A slide transition on an automatic navigation reads as a
  // glitch — the user did not ask to go anywhere.
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
