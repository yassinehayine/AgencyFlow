import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../../src/features/auth/SessionContext';
import { fr } from '../../src/i18n/fr';
import { TOUCH_TARGET, colors, spacing } from '../../src/theme/colors';

/**
 * `/(portal)/dashboard` — **placeholder. Phase 5 builds the real dashboard.**
 *
 * It carries a working sign-out, and that is not padding: it is the only way
 * to exercise the guard by hand before the login screen exists. Signing out
 * must land on the login screen and must not be reversible with the back
 * button — the property Phase 2 is meant to deliver.
 */
export default function DashboardScreen() {
  const { user, signOut } = useSession();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: fr.auth.portalTitle }} />

      <Text style={styles.greeting}>{user?.name ?? ''}</Text>
      <Text style={styles.placeholder}>{fr.portal.dashboardPlaceholder}</Text>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => void signOut()}
        accessibilityRole="button"
        accessibilityLabel={fr.auth.signOut}
      >
        <Text style={styles.buttonLabel}>{fr.auth.signOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  greeting: { fontSize: 22, fontWeight: '600', color: colors.text },
  placeholder: { marginTop: spacing.sm, fontSize: 14, color: colors.textSubtle },
  button: {
    marginTop: spacing.xl,
    // `minHeight` rather than padding alone: the target stays 44 pt even if
    // the label is later translated into something shorter.
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { fontSize: 15, fontWeight: '500', color: colors.onPrimary },
});
