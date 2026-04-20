import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { insforge, clearToken } from '@/insforge/client';

export default function NoOrg() {
  const router = useRouter();

  async function signOut() {
    await clearToken();
    await insforge.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>No organization yet</Text>
      <Text style={styles.body}>
        Your account isn't linked to an organization. Ask your admin to send
        you an invite link, then tap it to join.
      </Text>
      <TouchableOpacity onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f4f4f5', gap: 16 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center', color: '#525252' },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
