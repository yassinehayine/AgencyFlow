import { StyleSheet, Text, View } from 'react-native';

import { spacing } from '../theme/colors';

/**
 * A failure the user needs to read before acting again.
 *
 * `accessibilityLiveRegion="polite"` (Android) and `accessibilityRole="alert"`
 * (iOS) so the message is announced when it appears. Without them a screen
 * reader user taps "Se connecter", hears nothing, and has no way to know the
 * attempt failed — the button simply stops being busy.
 *
 * Carries the icon-free word as well as the colour: red alone is not a signal
 * for roughly one man in twelve (NFR-11).
 */
export function ErrorBanner({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessible
    >
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca', // red-200
    backgroundColor: '#fef2f2', // red-50
  },
  message: { fontSize: 14, lineHeight: 20, color: '#991b1b' }, // red-800
});
