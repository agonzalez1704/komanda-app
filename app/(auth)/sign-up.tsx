import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';
import { insforge, persistSession } from '@/insforge/client';
import { redeemInvitation } from '@/insforge/queries/invitations';
import { createOrganizationAndMember } from '@/insforge/queries/organizations';
import { Button, Chip, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { color, radius, shadow, space } from '@/theme/tokens';

type Mode = 'create' | 'invite';
type Step = 'form' | 'otp';

export default function SignUp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [mode, setMode] = useState<Mode>(params.token ? 'invite' : 'create');
  const [step, setStep] = useState<Step>('form');
  const [token, setToken] = useState(params.token ?? '');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      const parsed = Linking.parse(event.url);
      const t = (parsed.queryParams as any)?.token;
      if (typeof t === 'string') {
        setToken(t);
        setMode('invite');
      }
      const e = (parsed.queryParams as any)?.email;
      if (typeof e === 'string') setEmail(e);
    });
    return () => sub.remove();
  }, []);

  async function finishPostAuth() {
    if (mode === 'invite') {
      await redeemInvitation(token);
    } else {
      await createOrganizationAndMember(orgName, displayName);
    }
    router.replace('/(app)/komandas');
  }

  async function onSubmitForm() {
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const { data, error: signUpErr } = await insforge.auth.signUp({
        email,
        password,
        name: displayName,
      });

      if (signUpErr) {
        const msg = String(signUpErr?.message ?? '').toLowerCase();
        const alreadyExists =
          msg.includes('already') || msg.includes('exists') || msg.includes('registered');
        if (!alreadyExists) throw signUpErr;

        const { data: sess, error: siErr } = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        if (siErr) {
          const sMsg = String(siErr?.message ?? '').toLowerCase();
          if (sMsg.includes('verif')) {
            await insforge.auth.resendVerificationEmail({ email });
            setStep('otp');
            setInfo(`Account exists but isn't verified. We sent a code to ${email}`);
            return;
          }
          throw new Error('Account already exists. Sign in instead, or use a different email.');
        }
        if (sess?.accessToken) {
          const u = (sess as any)?.user;
          const userId: string | undefined = u?.id;
          const userEmail: string | undefined = u?.email ?? email;
          await persistSession({
            accessToken: sess.accessToken,
            refreshToken: sess.refreshToken ?? null,
            user: userId && userEmail ? { id: userId, email: userEmail } : null,
          });
        }
        await finishPostAuth();
        return;
      }

      if (data?.requireEmailVerification) {
        setStep('otp');
        setInfo(`We sent a 6-digit code to ${email}`);
        return;
      }

      if (data?.accessToken) {
        const u = (data as any)?.user;
        const userId: string | undefined = u?.id;
        const userEmail: string | undefined = u?.email ?? email;
        await persistSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          user: userId && userEmail ? { id: userId, email: userEmail } : null,
        });
      } else {
        const { data: sess, error: siErr } = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        if (siErr) throw siErr;
        if (sess?.accessToken) {
          const u = (sess as any)?.user;
          const userId: string | undefined = u?.id;
          const userEmail: string | undefined = u?.email ?? email;
          await persistSession({
            accessToken: sess.accessToken,
            refreshToken: sess.refreshToken ?? null,
            user: userId && userEmail ? { id: userId, email: userEmail } : null,
          });
        }
      }

      await finishPostAuth();
    } catch (e: any) {
      setError(e?.message ?? 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyOtp() {
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: verifyErr } = await insforge.auth.verifyEmail({ email, otp });
      if (verifyErr) throw verifyErr;
      if (!data?.accessToken) throw new Error('Verification did not return a session');
      const u = (data as any)?.user;
      const userId: string | undefined = u?.id;
      const userEmail: string | undefined = u?.email ?? email;
      await persistSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        user: userId && userEmail ? { id: userId, email: userEmail } : null,
      });
      await finishPostAuth();
    } catch (e: any) {
      setError(e?.message ?? 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const { error: resendErr } = await insforge.auth.resendVerificationEmail({ email });
      if (resendErr) throw resendErr;
      setInfo(`New code sent to ${email}`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not resend code');
    } finally {
      setResending(false);
    }
  }

  const createDisabled = submitting || !email || !password || !displayName || !orgName;
  const inviteDisabled = submitting || !email || !password || !displayName || !token;
  const formDisabled = mode === 'create' ? createDisabled : inviteDisabled;
  const otpDisabled = submitting || otp.length !== 6;

  return (
    <Screen
      avoidKeyboard
      scrollable
      contentContainerStyle={{ gap: space.lg, paddingTop: space.sm, paddingBottom: space.xxl }}
    >
      <ScreenHeader
        showBack
        title={
          step === 'otp'
            ? 'Verify email'
            : mode === 'create'
            ? 'Create account'
            : 'Accept invite'
        }
      />

      <View style={styles.card}>
        {step === 'form' ? (
          <>
            <View style={styles.segmented}>
              <Chip
                block
                label="New organization"
                tone="neutral"
                selected={mode === 'create'}
                onPress={() => setMode('create')}
              />
              <Chip
                block
                label="Accept invite"
                tone="neutral"
                selected={mode === 'invite'}
                onPress={() => setMode('invite')}
              />
            </View>

            <View style={{ gap: space.md }}>
              {mode === 'invite' ? (
                <TextField
                  label="Invite token"
                  placeholder="Paste or enter token"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                />
              ) : (
                <TextField
                  label="Organization name"
                  placeholder="e.g. Tacos El Güero"
                  value={orgName}
                  onChangeText={setOrgName}
                />
              )}

              <TextField
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <TextField
                label="Your name"
                placeholder="First and last name"
                value={displayName}
                onChangeText={setDisplayName}
                autoComplete="name"
                textContentType="name"
              />
              <TextField
                label="Password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password-new"
                textContentType="newPassword"
                error={error}
              />
            </View>

            <Button
              label={mode === 'create' ? 'Create account & organization' : 'Accept invite'}
              onPress={onSubmitForm}
              disabled={formDisabled}
              loading={submitting}
              style={{ marginTop: space.lg }}
            />
          </>
        ) : (
          <>
            {info ? <Text style={styles.info}>{info}</Text> : null}
            <View style={{ gap: space.md }}>
              <TextField
                label="6-digit code"
                placeholder="123456"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                error={error}
              />
            </View>

            <Button
              label="Verify & continue"
              onPress={onVerifyOtp}
              disabled={otpDisabled}
              loading={submitting}
              style={{ marginTop: space.lg }}
            />
            <Button
              label={resending ? 'Sending…' : 'Resend code'}
              onPress={onResend}
              disabled={resending || submitting}
              variant="ghost"
            />
            <Button
              label="Use a different email"
              onPress={() => {
                setStep('form');
                setOtp('');
                setError(null);
                setInfo(null);
              }}
              disabled={submitting}
              variant="ghost"
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    ...shadow.md,
  },
  segmented: {
    flexDirection: 'row',
    gap: space.sm,
  },
  info: {
    color: color.textMuted,
    fontSize: 14,
  },
});
