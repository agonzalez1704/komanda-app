import { StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { color, fontWeight, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';

export type BreakEvenCardProps = {
  fixedDailyCostCents: number;
  /** Map of "label" → units/day needed to break even with that item only. */
  scenarios: Array<{
    label: string;
    units: number;          // Number.POSITIVE_INFINITY when margin <= 0
  }>;
};

/**
 * Headline break-even card. Shows total fixed daily cost and, for each
 * scenario, the units/day needed if that scenario were 100% of sales.
 */
export function BreakEvenCard({
  fixedDailyCostCents,
  scenarios,
}: BreakEvenCardProps) {
  return (
    <Card style={styles.card}>
      <Text variant="h3">Daily break-even</Text>
      <View style={styles.headlineRow}>
        <Text variant="caption">Fixed daily cost</Text>
        <Text style={styles.headline}>{formatMXN(fixedDailyCostCents)}</Text>
      </View>
      <Text variant="footnote">
        Units/day to cover fixed cost if you sold only this item:
      </Text>
      <View style={styles.scenarioList}>
        {scenarios.length === 0 ? (
          <Text variant="footnote">
            Add ingredients + recipes to see break-even scenarios.
          </Text>
        ) : (
          scenarios.map((s) => (
            <View key={s.label} style={styles.scenarioRow}>
              <Text variant="bodyStrong">{s.label}</Text>
              <Text variant="bodyStrong" style={{ color: color.textPrimary }}>
                {Number.isFinite(s.units) ? `${s.units}/day` : '— (no margin)'}
              </Text>
            </View>
          ))
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headline: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
  },
  scenarioList: {
    gap: space.xs,
    marginTop: space.xs,
  },
  scenarioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
