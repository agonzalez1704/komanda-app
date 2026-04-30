import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import {
  lookupInvitation,
  type InvitationPreview,
} from '@/insforge/queries/invitations';
import { useAcceptInvitation } from '@/mutations/useAcceptInvitation';
import { useSession } from '@/insforge/session';
import { insforge, persistSession } from '@/insforge/client';

/**
 * Public deep-link target for invite acceptance.
 *
 * Lives at `app/invite/accept.tsx` (NOT inside the `(app)` group) so the
 * `(app)/_layout.tsx` auth gate can't bounce signed-out users to sign-in
 * before they get a chance to verify the code. The root layout has no auth
 * gating — the Stack passes this through as a top-level route reachable
 * regardless of session state.
 */
export default function AcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const session = useSession();
  const qc = useQueryClient();

  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  const accept = useAcceptInvitation();

  useEffect(() => {
    if (preview && !email) setEmail(preview.email);
  }, [preview, email]);

  async function verify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const trimmed = code.trim().toUpperCase();
      const p = await lookupInvitation(trimmed);
      if (!p) {
        setVerifyError('Code is invalid.');
        return;
      }
      if (p.status === 'revoked') {
        setVerifyError('This invite has been revoked.');
        return;
      }
      if (p.status === 'accepted') {
        setVerifyError('This invite has already been used.');
        return;
      }
      if (new Date(p.expires_at).getTime() < Date.now()) {
        setVerifyError('This invite has expired. Ask your admin for a new one.');
        return;
      }
      setPreview(p);
    } catch (e) {
      setVerifyError(String((e as Error).message));
    } finally {
      setVerifying(false);
    }
  }

  async function joinSignedIn() {
    if (!preview) return;
    accept.mutate(
      { token: code.trim().toUpperCase(), displayName: displayName.trim() || undefined },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['membership'] });
          router.replace('/(app)/komandas');
        },
        onError: (e) => Alert.alert('Could not join', String((e as Error).message)),
      },
    );
  }

  async function signUpAndJoin() {
    if (!preview) return;
    setSigningUp(true);
    try {
      // SDK signature: signUp({ email, password, name? }) → { data, error }.
      const { data, error } = await insforge.auth.signUp({
        email,
        password,
        name: displayName.trim() || undefined,
      });
      if (error) throw new Error(error.message);

      // Persist the freshly-issued session so the next request (redeem RPC)
      // is authenticated. signUp may return tokens directly or, in setups
      // that gate on email verification, only return `requireEmailVerification`
      // — in that case we sign in to obtain the session.
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
        if (siErr) throw new Error(siErr.message);
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

      await accept.mutateAsync({
        token: code.trim().toUpperCase(),
        displayName: displayName.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: ['membership'] });
      router.replace('/(app)/komandas');
    } catch (e) {
      Alert.alert('Could not create account', String((e as Error).message));
    } finally {
      setSigningUp(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader title="Accept invite" />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card padded>
          <Text variant="caption">Invite code</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="XXXX-XXXX"
            style={styles.input}
            editable={!preview}
          />
          {!preview ? (
            <Button
              label={verifying ? 'Verifying…' : 'Verify code'}
              onPress={verify}
              disabled={verifying || !code.trim()}
            />
          ) : null}
          {verifyError ? (
            <Text
              variant="bodySm"
              style={{ color: color.danger, marginTop: space.sm }}
            >
              {verifyError}
            </Text>
          ) : null}
        </Card>

        {preview ? (
          <Card padded>
            <Text variant="bodyStrong">{preview.org_name}</Text>
            <Text
              variant="caption"
              style={{ textTransform: 'capitalize', marginTop: space.xs }}
            >
              Role: {preview.role}
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <Text variant="caption">Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                style={styles.input}
              />
            </View>
            {session.status === 'signed-in' ? (
              <Button
                label={
                  accept.isPending ? 'Joining…' : `Join ${preview.org_name}`
                }
                onPress={joinSignedIn}
                disabled={accept.isPending || !displayName.trim()}
              />
            ) : (
              <>
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  <Text variant="caption">Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                  />
                  <Text variant="caption">Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                  />
                </View>
                <Button
                  label={signingUp ? 'Creating account…' : 'Create account & join'}
                  onPress={signUpAndJoin}
                  disabled={
                    signingUp || !email || !password || !displayName.trim()
                  }
                />
              </>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.textPrimary,
    fontSize: 16,
    marginBottom: space.sm,
  },
});
