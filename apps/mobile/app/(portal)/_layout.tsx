import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { LoadingScreen } from '../../src/components/LoadingScreen';
import { useSession } from '../../src/features/auth/SessionContext';
import { isPortalUser, redirectFor } from '../../src/features/auth/session-routing';
import { colors } from '../../src/theme/colors';

/**
 * `(portal)` — everything behind a session.
 *
 * **This guard is a convenience, never the security boundary.** It can be
 * defeated by anyone willing to edit the bundle, and it does not matter: the
 * API refuses an unauthenticated request regardless, and applies BR-10 to
 * every authenticated one. What the guard buys is that a signed-out user sees
 * the login screen instead of a dashboard full of failed requests.
 *
 * **Android back.** Every entry into this group happens through `Redirect`,
 * which replaces rather than pushes. So the back button from the dashboard
 * exits the application, as a user expects — it does not walk backwards into
 * the login screen of a session that is still valid. That property comes from
 * using redirects consistently, so an imperative `router.push` into this group
 * would quietly break it.
 */
export default function PortalLayout() {
  const { status, user, signOut } = useSession();
  const destination = redirectFor(status, 'portal');

  /**
   * Defence in depth for a session that is valid but not a Client Contact's.
   *
   * `useLogin` already stops an agency account before anything is persisted,
   * so this only fires for a session that was stored and has since become
   * wrong — a role changed server-side, or a device carrying a session from
   * before that check existed. Rare, and cheap to close.
   *
   * In an effect rather than during render because it MUTATES: signing out
   * during a render is a state update in the middle of one. The guard below
   * handles the frame in between, so nothing renders for the wrong user.
   */
  useEffect(() => {
    if (status === 'authenticated' && !isPortalUser(user)) {
      void signOut();
    }
  }, [status, user, signOut]);

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (destination) {
    return <Redirect href={destination} />;
  }

  // The frame between the effect firing and the session clearing. Showing the
  // loading screen rather than the portal means an agency account never sees
  // a client's dashboard, however briefly.
  if (!isPortalUser(user)) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
        // A back label of "Retour" rather than the previous screen's title:
        // deliverable names are long, and a truncated one in a header bar
        // tells the user less than the word does.
        headerBackTitle: 'Retour',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
