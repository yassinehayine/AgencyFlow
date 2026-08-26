import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/features/auth/SessionContext';
import { colors } from '../src/theme/colors';

/**
 * Root layout — the shell every screen renders inside.
 *
 * `SessionProvider` sits at the very top because both route groups depend on
 * it: `(auth)` needs to know whether to send a signed-in user away, and
 * `(portal)` needs to know whether to let anyone in at all. Mounting it inside
 * either group would give the other no session to read.
 *
 * `SafeAreaProvider` wraps everything from the start rather than being added
 * when a notch first cuts a header in half. On a modern phone the unusable
 * region is the camera cutout and the home indicator — a layout that ignores
 * them puts controls where a finger cannot reach.
 *
 * `headerShown: false` at the root: each group brings its own chrome. The
 * portal wants a header, the login screen wants none, and a shared one would
 * have to be hidden in half the application anyway.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
