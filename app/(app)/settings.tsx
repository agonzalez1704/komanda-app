import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { insforge, clearToken } from '@/insforge/client';
import { fetchMyMembership } from '@/insforge/queries/membership';

export default function Settings() {
  const router = useRouter();
  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });

  async function signOut() {
    await clearToken();
    await insforge.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Account</Text>
      <Text style={styles.label}>Display name</Text>
      <Text style={styles.value}>{membership?.display_name ?? '—'}</Text>
      <Text style={styles.label}>Role</Text>
      <Text style={styles.value}>{membership?.role ?? '—'}</Text>
      <TouchableOpacity onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, backgroundColor: 'white', gap: 8 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  label: {
    fontSize: 12,
    color: '#737373',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: { fontSize: 16 },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
