import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Brand, Button, Copy, Field, Icon, IconButton, Title, replace, s } from '@/components/ui';
import { Notice } from '@/components/Notice';
import { colors } from '@/constants/theme';
import { useAuth } from '@/auth/AuthProvider';
import { performEmailAction } from '@/auth/actions';

function checkDemoMode(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEMO_MODE === 'true';
  } catch {
    return false;
  }
}

export default function SignInScreen() {
  const { recovery, setRecovery, signOut, signInAsDemo, error: sessionError } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register' | 'recover'>('signin');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit() {
    if (locked.current) return;
    setError('');
    locked.current = true;
    setBusy(true);
    try {
      if (
        checkDemoMode() &&
        signInAsDemo &&
        (email.toLowerCase().includes('demo') ||
          email.toLowerCase().includes('maria') ||
          email.toLowerCase().includes('test'))
      ) {
        await signInAsDemo('passenger');
        replace('/home');
        return;
      }
      const result = await performEmailAction(recovery ? 'reset' : mode, email, password, name);
      if (recovery) {
        setPassword('');
        setRecovery(false);
        replace('/home');
      } else if (mode === 'register') {
        setPassword('');
        if (result === 'authenticated') replace('/home');
        else {
          setMode('signin');
          setNotice(
            'Check your email for a confirmation link. After confirming, return here to sign in.',
          );
        }
      } else if (mode === 'recover') {
        setMode('signin');
        setNotice(
          'If an account exists for this address, a password recovery email will arrive. Open its link on a device with TalaRide installed.',
        );
      } else {
        setPassword('');
        replace('/home');
      }
    } catch (failure) {
      setError(formatAuthError(failure));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function formatAuthError(failure: unknown): string {
    if (!(failure instanceof Error)) {
      return 'The account request failed. Check your connection and try again.';
    }
    const msg = failure.message.toLowerCase();
    if (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('offline')
    ) {
      return 'Unable to reach the server. Please check your internet connection and try again.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link.';
    }
    if (msg.includes('invalid login credentials')) {
      return 'Invalid email address or password. Please check your credentials and try again.';
    }
    if (msg.includes('user already registered')) {
      return 'An account with this email address already exists. Please sign in instead.';
    }
    return failure.message;
  }
  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingVertical: 30 }}>
        <Brand large />
      </View>
      <Title style={{ textAlign: 'center', fontSize: 22 }}>
        {recovery
          ? 'Set a new password'
          : mode === 'register'
            ? 'Create your account'
            : mode === 'recover'
              ? 'Recover your password'
              : 'Welcome back!'}
      </Title>
      <Copy style={{ textAlign: 'center', color: colors.muted, marginTop: 4, marginBottom: 24 }}>
        {recovery
          ? 'Choose a new password for your account.'
          : mode === 'register'
            ? 'Keep your private ride history on your device.'
            : mode === 'recover'
              ? 'We’ll email you a password recovery link.'
              : 'Sign in to access your account.'}
      </Copy>
      <View style={{ gap: 10 }}>
        {mode === 'register' && !recovery && (
          <Field
            label="Display name"
            placeholder="Your name"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            maxLength={80}
            editable={!busy}
          />
        )}
        {!recovery && (
          <Field
            label="Email address"
            placeholder="Email address"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy}
          />
        )}
        {(recovery || mode !== 'recover') && (
          <Field
            label="Password"
            placeholder="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="off"
            editable={!busy}
            trailing={
              <IconButton
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                label={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />
        )}
      </View>
      {!recovery && mode === 'signin' && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setMode('recover');
            setError('');
            setPassword('');
          }}
          style={{ alignSelf: 'flex-end', paddingVertical: 12 }}
        >
          <Copy style={{ fontSize: 13, color: colors.darkGreen }}>Forgot password?</Copy>
        </Pressable>
      )}
      {!!(error || sessionError) && (
        <Copy accessibilityRole="alert" style={{ color: colors.red, marginBottom: 10 }}>
          {error || sessionError}
        </Copy>
      )}
      <Button
        label={
          busy
            ? 'Please wait…'
            : recovery
              ? 'Update Password'
              : mode === 'register'
                ? 'Sign Up'
                : mode === 'recover'
                  ? 'Send Recovery Email'
                  : 'Sign In'
        }
        disabled={busy}
        onPress={() => void submit()}
      />
      {recovery && (
        <Button
          label="Cancel Recovery"
          variant="subtle"
          disabled={busy}
          onPress={() => {
            if (locked.current) return;
            locked.current = true;
            setBusy(true);
            void signOut()
              .then(() => setPassword(''))
              .catch((failure) => setError(failure.message))
              .finally(() => {
                locked.current = false;
                setBusy(false);
              });
          }}
          style={{ marginTop: 12 }}
        />
      )}
      {!recovery && mode !== 'signin' && (
        <Button
          label="Back to Sign In"
          variant="subtle"
          disabled={busy}
          onPress={() => {
            setMode('signin');
            setError('');
            setPassword('');
          }}
          style={{ marginTop: 12 }}
        />
      )}
      {!recovery && mode === 'signin' && (
        <>
          <View style={[s.row, { marginVertical: 20 }]}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Copy style={{ fontSize: 13 }}>or continue with</Copy>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          <View style={{ gap: 10 }}>
            {(['Google', 'Apple'] as const).map((provider) => (
              <Pressable
                key={provider}
                accessibilityRole="button"
                accessibilityLabel={`Continue with ${provider} — not configured`}
                disabled={busy}
                onPress={() =>
                  setNotice(
                    `${provider} sign-in is not configured for this project yet. Please use email and password.`,
                  )
                }
                style={[
                  s.row,
                  {
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    minHeight: 48,
                  },
                ]}
              >
                {provider === 'Google' ? (
                  <Copy bold style={{ fontSize: 24, color: '#4285F4' }}>
                    G
                  </Copy>
                ) : (
                  <Icon name="logo-apple" size={25} />
                )}
                <Copy bold>Continue with {provider}</Copy>
              </Pressable>
            ))}
          </View>
          <Copy style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
            Google and Apple sign-in are not configured yet.
          </Copy>
          <View
            style={[s.row, { justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 24 }]}
          >
            <Copy>Don’t have an account?</Copy>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setMode('register');
                setError('');
                setPassword('');
              }}
            >
              <Copy bold style={{ color: colors.darkGreen }}>
                Sign Up
              </Copy>
            </Pressable>
          </View>
        </>
      )}
      {checkDemoMode() && !recovery && (
        <View
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.paleGreen,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="flash" size={16} color={colors.darkGreen} />
            <Copy bold style={{ color: colors.darkGreen, fontSize: 13 }}>
              Development Testing Mode
            </Copy>
          </View>
          <Copy style={{ fontSize: 12, color: colors.muted }}>
            Instant local test session for paired web/mobile testing.
          </Copy>
          <View style={{ gap: 8, marginTop: 4 }}>
            <Button
              label="Sign In as Commuter (Maria Santos)"
              variant="primary"
              disabled={busy}
              onPress={async () => {
                if (locked.current) return;
                locked.current = true;
                setBusy(true);
                try {
                  if (signInAsDemo) await signInAsDemo('passenger');
                  replace('/home');
                } finally {
                  locked.current = false;
                  setBusy(false);
                }
              }}
            />
            <Button
              label="Sign In as Driver (Juan Dela Cruz)"
              variant="subtle"
              disabled={busy}
              onPress={async () => {
                if (locked.current) return;
                locked.current = true;
                setBusy(true);
                try {
                  if (signInAsDemo) await signInAsDemo('driver');
                  replace('/driver');
                } finally {
                  locked.current = false;
                  setBusy(false);
                }
              }}
            />
          </View>
        </View>
      )}
      {!!notice && (
        <Notice title="Account information" message={notice} onClose={() => setNotice('')} />
      )}
    </Screen>
  );
}
