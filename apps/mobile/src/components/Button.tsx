import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { TOUCH_TARGET, colors, spacing } from '../theme/colors';

/**
 * The primary action button.
 *
 * Two behaviours worth naming, because both are about not lying to the user:
 *
 * **Loading replaces the label with a spinner and disables the press.** A
 * button that still looks pressable during a request invites a second tap,
 * and a second `POST /auth/login` is a second bcrypt verification on the
 * server for no reason.
 *
 * **Disabled is dimmed AND announced.** `accessibilityState` carries it to a
 * screen reader, so the reason a tap does nothing is available to someone who
 * cannot see the opacity change (NFR-11).
 */
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600', color: colors.onPrimary },
});
