import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fr } from '../i18n/fr';
import { colors, spacing } from '../theme/colors';

/**
 * Shown while the session is being restored from the Keystore.
 *
 * Brief — usually a frame or two — but not skippable: it is what stands
 * between a signed-in user and a flash of the login screen. It carries text as
 * well as a spinner because a bare spinner says "something is happening" while
 * a labelled one says what (NFR-11: never one signal alone).
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{fr.common.loading}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  label: { fontSize: 15, color: colors.textMuted },
});
