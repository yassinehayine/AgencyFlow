import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { TextField } from '../../src/components/TextField';
import { useLogin } from '../../src/features/auth/useLogin';
import { hasErrors, validateLogin } from '../../src/features/auth/login-validation';
import type { LoginFieldErrors } from '../../src/features/auth/login-validation';
import { fr } from '../../src/i18n/fr';
import { colors, spacing } from '../../src/theme/colors';

/**
 * `/(auth)/login` — FR-001, FR-002.
 *
 * There is no "create an account" link, and its absence is the interface half
 * of FR-007: accounts exist only because an Administrator made one (BR-11).
 * A hint says where credentials come from instead of a control leading
 * nowhere.
 *
 * The keyboard shapes this screen more than the styling does. On a phone it
 * covers roughly half the display, so the form is inside a
 * `KeyboardAvoidingView` **and** a `ScrollView`: the first lifts the fields
 * clear, the second guarantees the button can still be reached on a short
 * screen where lifting alone is not enough.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { outcome, submit, reset } = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  const passwordRef = useRef<TextInput>(null);
  const submitting = outcome.state === 'submitting';

  function handleSubmit() {
    const errors = validateLogin(email, password);
    setFieldErrors(errors);

    if (hasErrors(errors)) {
      return;
    }

    // Trimmed and lowercased to match what the API does to it anyway
    // (`LoginDto` applies the same transform), so a stray capital from an
    // autocorrecting keyboard never becomes a failed sign-in.
    void submit({ email: email.trim().toLowerCase(), password });
  }

  /**
   * Clearing the previous failure as soon as the user edits anything.
   *
   * A banner that survives the correction of the thing it complained about is
   * actively misleading — the user fixes their password, taps the button, and
   * the old message is still on screen while the request is in flight.
   */
  function handleChange(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);

      if (outcome.state === 'error' || outcome.state === 'rejected') {
        reset();
      }
    };
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      // `padding` on iOS, `height` on Android: the two platforms report the
      // keyboard differently, and the wrong one leaves the fields covered.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{fr.common.appName}</Text>
          <Text style={styles.subtitle}>{fr.auth.subtitle}</Text>
        </View>

        {outcome.state === 'rejected' ? (
          <View style={styles.rejected}>
            <Text style={styles.rejectedTitle}>{outcome.title}</Text>
            <Text style={styles.rejectedBody}>{outcome.message}</Text>
          </View>
        ) : null}

        {outcome.state === 'error' ? <ErrorBanner message={outcome.message} /> : null}

        <View style={styles.form}>
          <TextField
            label={fr.auth.email}
            value={email}
            onChangeText={handleChange(setEmail)}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            editable={!submitting}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <TextField
            ref={passwordRef}
            label={fr.auth.password}
            value={password}
            onChangeText={handleChange(setPassword)}
            error={fieldErrors.password}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            editable={!submitting}
            onSubmitEditing={handleSubmit}
          />

          <Button
            label={submitting ? fr.auth.signingIn : fr.auth.signIn}
            onPress={handleSubmit}
            loading={submitting}
          />
        </View>

        <Text style={styles.hint}>{fr.auth.noAccountHint}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  header: { gap: spacing.xs },
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.textMuted },
  form: { gap: spacing.md },
  hint: { fontSize: 13, textAlign: 'center', color: colors.textSubtle },
  rejected: {
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  rejectedTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rejectedBody: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
