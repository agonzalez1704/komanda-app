import { StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { color, fontWeight, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';

export type MarginSummaryCardProps = {
  title: string;
  inStorePriceCents: number;
  uberPriceCents: number;
  ingredientCostCents: number;
  inStoreMarginCents: number;
  uberMarginCents: number;
};

/**
 * Stateless margin summary for a single product. Negative margin is
 * rendered in danger color so the owner can spot it instantly.
 */
export function MarginSummaryCard({
  title,
  inStorePriceCents,
  uberPriceCents,
  ingredientCostCents,
  inStoreMarginCents,
  uberMarginCents,
}: MarginSummaryCardProps) {
  return (
    <Card style={styles.card}>
      <Text variant="h3">{title}</Text>
      <View style={styles.row}>
        <Text variant="caption">In-store price</Text>
        <Text variant="bodyStrong">{formatMXN(inStorePriceCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text variant="caption">Uber Eats price</Text>
        <Text variant="bodyStrong">{formatMXN(uberPriceCents)}</Text>
      </View>
      <View style={styles.row}>
        <Text variant="caption">Ingredient cost</Text>
        <Text variant="bodyStrong">{formatMXN(ingredientCostCents)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text variant="caption">Margin (in-store)</Text>
        <Text style={[styles.value, marginStyle(inStoreMarginCents)]}>
          {formatMXN(inStoreMarginCents)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="caption">Margin (Uber Eats, net of fee)</Text>
        <Text style={[styles.value, marginStyle(uberMarginCents)]}>
          {formatMXN(uberMarginCents)}
        </Text>
      </View>
    </Card>
  );
}

function marginStyle(cents: number) {
  return {
    color: cents < 0 ? color.danger : color.textPrimary,
  };
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: color.border,
    marginVertical: space.xs,
  },
  value: {
    fontWeight: fontWeight.bold,
  },
});
