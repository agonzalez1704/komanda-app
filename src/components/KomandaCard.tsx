import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusPill } from './StatusPill';
import { displayIdentifier } from '@/domain/komandaNumber';
import { formatMXN } from '@/domain/money';
import type { KomandaRowT } from '@/insforge/schemas';

export function KomandaCard({
  k,
  itemCount,
  runningTotalCents,
  onPress,
  syncedServerSide,
}: {
  k: KomandaRowT;
  itemCount: number;
  runningTotalCents: number;
  onPress: () => void;
  syncedServerSide: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.id}>{displayIdentifier(k)}</Text>
        <StatusPill status={k.status} />
      </View>
      {k.display_name ? <Text style={styles.display}>{k.display_name}</Text> : null}
      <View style={styles.row}>
        <Text style={styles.meta}>
          {itemCount} item{itemCount === 1 ? '' : 's'}
          {syncedServerSide ? '' : ' · ☁︎ pending'}
        </Text>
        <Text style={styles.total}>{formatMXN(runningTotalCents)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, backgroundColor: 'white', borderRadius: 10, gap: 6, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  id: { fontSize: 14, fontWeight: '600' },
  display: { fontSize: 13, color: '#404040' },
  meta: { fontSize: 12, color: '#737373' },
  total: { fontSize: 16, fontWeight: '700' },
});
