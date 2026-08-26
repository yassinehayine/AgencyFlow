import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { TOUCH_TARGET, colors, spacing } from '../theme/colors';

/**
 * A labelled text input.
 *
 * The label is a real `<Text>` above the field rather than a placeholder
 * inside it. A placeholder disappears the moment someone starts typing, which
 * is exactly when they might want to check what the field was asking for —
 * and it is invisible to a screen reader once filled.
 *
 * `forwardRef` so a form can move focus from one field to the next on
 * "return". On a phone that saves a deliberate tap into a small target.
 */
export const TextField = forwardRef<TextInput, TextInputProps & { label: string; error?: string }>(
  function TextField({ label, error, ...props }, ref) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>

        <TextInput
          ref={ref}
          style={[styles.input, error ? styles.inputError : null]}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={label}
          // Announced together with the field, so the error is heard by
          // someone who cannot see the red border.
          accessibilityHint={error}
          {...props}
        />

        {/* `role="alert"` so a screen reader announces the message when it
            appears, rather than only when the field is next focused. */}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '500', color: colors.text },
  input: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    fontSize: 16, // 16 or larger, or iOS Safari-style auto-zoom fights the layout
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, color: colors.danger },
});
