import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useCreateKomanda } from '@/mutations/useCreateKomanda';

export default function NewKomanda() {
  const router = useRouter();
  const create = useCreateKomanda();
  const [name, setName] = useState('');

  async function go() {
    const row = await create.mutateAsync({ display_name: name.trim() || null });
    router.replace(`/(app)/komandas/${row.id}`);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Text style={styles.title}>New komanda</Text>
      <Text style={styles.label}>Optional rename (e.g. "Table 5")</Text>
      <TextInput
        placeholder="Leave empty for auto number"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TouchableOpacity onPress={go} disabled={create.isPending} style={[styles.button, create.isPending && styles.buttonDisabled]}>
        {create.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Open komanda</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: 'white', gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 12, color: '#737373', marginTop: 12, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { color: '#737373', fontSize: 14 },
});
