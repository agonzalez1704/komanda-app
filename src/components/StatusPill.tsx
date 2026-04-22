import { StyleSheet, Text, View } from 'react-native';
import type { KomandaStatusT } from '@/insforge/schemas';

const COLORS: Record<KomandaStatusT, { bg: string; fg: string }> = {
  open:    { bg: '#dbeafe', fg: '#1e3a8a' },
  pending: { bg: '#fef3c7', fg: '#78350f' },
  served:  { bg: '#dcfce7', fg: '#14532d' },
  closed:  { bg: '#e5e5e5', fg: '#262626' },
};

export function StatusPill({ status }: { status: KomandaStatusT }) {
  const c = COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
