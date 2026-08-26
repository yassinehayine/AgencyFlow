import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { fr } from '../src/i18n/fr';
import { TOUCH_TARGET, colors, spacing } from '../src/theme/colors';

/**
 * Any address that matches no screen.
 *
 * Reachable on mobile in a way it is not on the web: the app registers the
 * `agencyflow://` scheme (`app.json`), so a stale or mistyped deep link lands
 * here. Without this file Expo Router shows its own developer screen, which
 * mentions file-based routing to someone who only wanted to open a link.
 *
 * The way out goes to `/`, not to a fixed screen — `/` is the one route that
 * knows whether this person has a session.
 */
export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: fr.errors.notFoundTitle, headerShown: true }} />

      <Text style={styles.title}>{fr.errors.notFoundTitle}</Text>
      <Text style={styles.body}>{fr.errors.notFoundBody}</Text>

      <Link href="/" style={styles.link}>
        <Text style={styles.linkLabel}>{fr.errors.backToStart}</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  title: { fontSize: 20, fontWeight: '600', color: colors.text },
  body: { marginTop: spacing.sm, fontSize: 15, textAlign: 'center', color: colors.textMuted },
  link: { marginTop: spacing.lg, minHeight: TOUCH_TARGET, justifyContent: 'center' },
  linkLabel: { fontSize: 15, fontWeight: '500', color: colors.primary },
});
