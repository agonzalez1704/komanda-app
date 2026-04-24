import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { insforge, persistSession } from '@/insforge/client';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { color, palette, radius, shadow, space } from '@/theme/tokens';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: signInErr } = await insforge.auth.signInWithPassword({ email, password });
      console.log('[sign-in] result', {
        hasData: !!data,
        hasAccess: !!data?.accessToken,
        hasRefresh: !!data?.refreshToken,
        hasUser: !!(data as any)?.user,
        userId: (data as any)?.user?.id,
        errMsg: signInErr?.message,
      });
      if (signInErr) throw signInErr;
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
        throw new Error('No access token returned');
      }
      router.replace('/(app)/komandas');
    } catch (e: any) {
      setError(e?.message ?? 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !email || !password;

  return (
    <Screen avoidKeyboard scrollable contentContainerStyle={styles.root}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Ionicons name="restaurant" size={30} color={palette.terracotta500} />
        </View>
        <Text variant="display" align="center" style={styles.wordmark}>
          Komanda
        </Text>
        <Text variant="bodySm" align="center">
          Taco restaurant point-of-sale
        </Text>
      </View>

      <View style={styles.card}>
        <Text variant="h2" style={{ marginBottom: space.xs }}>
          Sign in
        </Text>
        <Text variant="bodySm" style={{ marginBottom: space.lg }}>
          Enter your email and password to continue.
        </Text>

        <View style={{ gap: space.md }}>
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
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            error={error}
          />
        </View>

        <Button
          label="Sign in"
          onPress={onSubmit}
          disabled={disabled}
          loading={submitting}
          style={{ marginTop: space.xl }}
        />

        <Link href="/(auth)/sign-up" asChild>
          <Pressable style={styles.link} accessibilityRole="link">
            <Text style={{ color: color.primary }}>
              New here? Create an account or accept an invite
            </Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: space.xxxl,
    gap: space.xxl,
  },
  brand: {
    alignItems: 'center',
    gap: space.sm,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: palette.terracotta50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
    ...shadow.sm,
  },
  wordmark: {
    letterSpacing: -0.8,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    ...shadow.md,
  },
  link: {
    alignSelf: 'center',
    marginTop: space.lg,
  },
});
