import { Redirect } from 'expo-router';

import { LoadingScreen } from '../src/components/LoadingScreen';
import { useSession } from '../src/features/auth/SessionContext';
import { ROUTES } from '../src/features/auth/session-routing';

/**
 * `/` — decides where a launch belongs, and renders nothing itself.
 *
 * This replaces the Phase 1 verification screen, whose job is done and whose
 * evidence is recorded in ADR-0007.
 *
 * **It waits.** Reading the Keystore is asynchronous, so on the first frame
 * the session is genuinely unknown. Redirecting during that frame would send
 * a signed-in user to the login screen and then bounce them back — visible as
 * a flash, and enough to lose a deep link on the way.
 *
 * `Redirect` rather than an imperative `router.replace` in an effect: it
 * navigates during render, before anything is painted, and Expo Router does
 * not warn about navigating before the root layout has mounted.
 */
export default function Index() {
  const { status } = useSession();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return <Redirect href={status === 'authenticated' ? ROUTES.dashboard : ROUTES.login} />;
}
