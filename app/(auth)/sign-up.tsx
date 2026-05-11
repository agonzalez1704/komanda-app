import { useEffect, useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, View } from 'react-native';
import { insforge, persistSession } from '@/insforge/client';
import { createOrganizationAndMember } from '@/insforge/queries/organizations';
import { Button, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { color, radius, shadow, space } from '@/theme/tokens';

/**
 * Sign-up creates a new organization. Invitees come in through
 * `app/invite/accept.tsx` (deep link) — there is no invite-mode toggle
 * on this screen. If a deep link delivers a `?code=` param it is
 * forwarded to /invite/accept.
 */

type Step = 'form' | 'otp';

export default function SignUp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Forward late-arriving deep links to the canonical invite funnel so the
  // user never sees a token field on this screen.
  useEffect(() => {
    if (params.code) {
      router.replace(
        `/invite/accept?code=${encodeURIComponent(String(params.code))}`,
      );
      return;
    }
    const sub = Linking.addEventListener('url', (event) => {
      const parsed = Linking.parse(event.url);
      const code = (parsed.queryParams as any)?.code;
      if (typeof code === 'string') {
        router.replace(`/invite/accept?code=${encodeURIComponent(code)}`);
      }
    });
    return () => sub.remove();
  }, [params.code, router]);

  async function finishPostAuth() {
    await createOrganizationAndMember(orgName, displayName);
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
            setInfo(`La cuenta existe pero no está verificada. Te enviamos un código a ${email}`);
            return;
          }
          throw new Error('La cuenta ya existe. Inicia sesión, o usa otro correo.');
        }
        if (sess?.accessToken) {
          const u = (sess as any)?.user;
          await persistSession({
            accessToken: sess.accessToken,
            refreshToken: sess.refreshToken ?? null,
            user:
              u?.id && (u?.email ?? email)
                ? { id: u.id, email: u.email ?? email }
                : null,
          });
        }
        await finishPostAuth();
        return;
      }

      if (data?.requireEmailVerification) {
        setStep('otp');
        setInfo(`Te enviamos un código de 6 dígitos a ${email}`);
        return;
      }

      if (data?.accessToken) {
        const u = (data as any)?.user;
        await persistSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          user:
            u?.id && (u?.email ?? email)
              ? { id: u.id, email: u.email ?? email }
              : null,
        });
      } else {
        const { data: sess, error: siErr } = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        if (siErr) throw siErr;
        if (sess?.accessToken) {
          const u = (sess as any)?.user;
          await persistSession({
            accessToken: sess.accessToken,
            refreshToken: sess.refreshToken ?? null,
            user:
              u?.id && (u?.email ?? email)
                ? { id: u.id, email: u.email ?? email }
                : null,
          });
        }
      }

      await finishPostAuth();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo crear la cuenta');
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
      if (!data?.accessToken) throw new Error('La verificación no devolvió una sesión');
      const u = (data as any)?.user;
      await persistSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        user:
          u?.id && (u?.email ?? email)
            ? { id: u.id, email: u.email ?? email }
            : null,
      });
      await finishPostAuth();
    } catch (e: any) {
      setError(e?.message ?? 'La verificación falló');
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
      setInfo(`Nuevo código enviado a ${email}`);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  }

  const formDisabled = submitting || !email || !password || !displayName || !orgName;
  const otpDisabled = submitting || otp.length !== 6;

  return (
    <Screen
      avoidKeyboard
      scrollable
      contentContainerStyle={{ gap: space.lg, paddingTop: space.sm, paddingBottom: space.xxl }}
    >
      <ScreenHeader
        showBack
        title={step === 'otp' ? 'Verifica tu correo' : 'Crear cuenta'}
      />

      <View style={styles.card}>
        {step === 'form' ? (
          <>
            <Text variant="bodySm" style={{ marginBottom: space.md }}>
              Crea una cuenta y abre tu nueva organización en Komanda.
            </Text>

            <View style={{ gap: space.md }}>
              <TextField
                label="Nombre de la organización"
                placeholder="Ej. Tacos El Güero"
                value={orgName}
                onChangeText={setOrgName}
              />
              <TextField
                label="Correo"
                placeholder="tu@correo.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <TextField
                label="Tu nombre"
                placeholder="Nombre y apellido"
                value={displayName}
                onChangeText={setDisplayName}
                autoComplete="name"
                textContentType="name"
              />
              <TextField
                label="Contraseña"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password-new"
                textContentType="newPassword"
                error={error}
              />
            </View>

            <Button
              label="Crear cuenta y organización"
              onPress={onSubmitForm}
              disabled={formDisabled}
              loading={submitting}
              style={{ marginTop: space.lg }}
            />

            <Link href="/invite/accept" asChild>
              <Pressable style={styles.link} accessibilityRole="link">
                <Text style={{ color: color.primary }}>
                  ¿Tienes un código de invitación?
                </Text>
              </Pressable>
            </Link>
          </>
        ) : (
          <>
            {info ? <Text style={styles.info}>{info}</Text> : null}
            <View style={{ gap: space.md }}>
              <TextField
                label="Código de 6 dígitos"
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
              label="Verificar y continuar"
              onPress={onVerifyOtp}
              disabled={otpDisabled}
              loading={submitting}
              style={{ marginTop: space.lg }}
            />
            <Button
              label={resending ? 'Enviando…' : 'Reenviar código'}
              onPress={onResend}
              disabled={resending || submitting}
              variant="ghost"
            />
            <Button
              label="Usar otro correo"
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
  info: {
    color: color.textMuted,
    fontSize: 14,
  },
  link: {
    alignSelf: 'center',
    marginTop: space.md,
  },
});
