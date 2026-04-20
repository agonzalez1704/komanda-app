import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { insforge, persistToken } from '@/insforge/client';
import { redeemInvitation } from '@/insforge/queries/invitations';

export default function SignUp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      const parsed = Linking.parse(event.url);
      const t = (parsed.queryParams as any)?.token;
      if (typeof t === 'string') setToken(t);
      const e = (parsed.queryParams as any)?.email;
      if (typeof e === 'string') setEmail(e);
    });
    return () => sub.remove();
  }, []);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      // Step 1: Create account
      const { error: signUpErr } = await insforge.auth.signUp({
        email,
        password,
        name: displayName,
      });
      if (signUpErr) throw signUpErr;

      // Step 2: Sign in to get session token
      const { data: sessionData, error: signInErr } = await insforge.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;

      // Step 3: Persist token
      if (sessionData?.accessToken) await persistToken(sessionData.accessToken);

      // Step 4: Redeem invitation
      await redeemInvitation(token);

      router.replace('/(app)/komandas');
    } catch (e: any) {
      setError(e?.message ?? 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Accept invite</Text>
        <TextInput
          placeholder="Invite token"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          disabled={submitting || !token || !email || !password || !displayName}
          onPress={onSubmit}
          style={[
            styles.button,
            (submitting || !token || !email || !password || !displayName) && styles.buttonDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', backgroundColor: '#f4f4f5' },
  card: { padding: 20, margin: 20, backgroundColor: 'white', borderRadius: 12, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', fontSize: 14 },
});
