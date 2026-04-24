import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export function TotalCard({ totalCents }: { totalCents: number }) {
  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text variant="h3">Total</Text>
          <Text mono style={styles.money}>
            {formatMXN(totalCents)}
          </Text>
        </View>
        <Text variant="caption" align="right">
          IVA incluido · MXN
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: space.lg,
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  money: {
    fontSize: 30,
    fontWeight: fontWeight.heavy,
    color: color.textPrimary,
    letterSpacing: -0.3,
  },
});
