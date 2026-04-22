import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useQueueSnapshot } from '@/offline/useQueueSnapshot';
import { dequeue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';

const RETRY_BUDGET = 5;

export function StuckMutationsBanner() {
  const all = useQueueSnapshot();
  const stuck = all.filter((m) => m.attemptCount >= RETRY_BUDGET);
  if (stuck.length === 0) return null;

  function onPress() {
    Alert.alert(
      `${stuck.length} pending sync issue${stuck.length === 1 ? '' : 's'}`,
      stuck.map((m) => `· ${m.type}: ${m.lastError ?? 'unknown'}`).join('\n'),
      [
        { text: 'Leave for now', style: 'cancel' },
        {
          text: 'Discard all',
          style: 'destructive',
          onPress: async () => {
            for (const m of stuck) await dequeue(queueStore, m.id);
          },
        },
      ]
    );
  }

  return (
    <TouchableOpacity onPress={onPress} style={styles.banner}>
      <Text style={styles.text}>
        ⚠ {stuck.length} change{stuck.length === 1 ? '' : 's'} failed to sync — tap for details
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#dc2626', paddingVertical: 8, paddingHorizontal: 12 },
  text: { color: 'white', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
