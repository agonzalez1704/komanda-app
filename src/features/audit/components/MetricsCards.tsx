import { StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { color, fontWeight, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';
import type { AuditAggregate } from '@/domain/audit';

type Props = { data: AuditAggregate };

export function MetricsCards({ data }: Props) {
  const netNegative = data.net < 0;
  const earnings = data.earnings;
  const expenses = data.expenses;

  return (
    <View style={styles.wrap}>
      <Card>
        <Text variant="label">Net profit</Text>
        <Text
          style={[
            styles.bigAmount,
            { color: netNegative ? color.danger : color.textPrimary },
          ]}
          mono
        >
          {formatMXN(data.net)}
        </Text>
      </Card>

      <View style={styles.duo}>
        <Card style={styles.smallCard}>
          <Text variant="label">Earnings</Text>
          <Text mono style={styles.midAmount}>
            {formatMXN(earnings.total)}
          </Text>
          <View style={styles.breakdown}>
            <Text variant="footnote">
              Cash {formatMXN(earnings.byPaymentMethod.cash)}
            </Text>
            <Text variant="footnote">
              Card {formatMXN(earnings.byPaymentMethod.card)}
            </Text>
            <Text variant="footnote">
              Transfer {formatMXN(earnings.byPaymentMethod.transfer)}
            </Text>
          </View>
        </Card>

        <Card style={styles.smallCard}>
          <Text variant="label">Expenses</Text>
          <Text mono style={styles.midAmount}>
            {formatMXN(expenses.total)}
          </Text>
          <View style={styles.breakdown}>
            <Text variant="footnote">
              Cash {formatMXN(expenses.byPaidBy.cash)}
            </Text>
            <Text variant="footnote">
              Card {formatMXN(expenses.byPaidBy.card)}
            </Text>
            <Text variant="footnote">
              Personal {formatMXN(expenses.byPaidBy.personal)}
            </Text>
          </View>
        </Card>
      </View>

      <Card>
        <Text variant="label">Cash drawer expected</Text>
        <Text mono style={styles.midAmount}>
          {formatMXN(data.cashDrawerExpected)}
        </Text>
        <Text variant="caption" style={{ marginTop: space.xs }}>
          (cash earnings − cash expenses; personal excluded)
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.md,
  },
  bigAmount: {
    fontSize: 32,
    lineHeight: 42,
    includeFontPadding: false,
    fontWeight: fontWeight.bold,
    marginTop: space.xs,
    fontVariant: ['tabular-nums'],
  },
  midAmount: {
    fontSize: 22,
    lineHeight: 30,
    includeFontPadding: false,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
    marginTop: space.xs,
    fontVariant: ['tabular-nums'],
  },
  duo: {
    flexDirection: 'row',
    gap: space.md,
  },
  smallCard: {
    flex: 1,
  },
  breakdown: {
    marginTop: space.sm,
    gap: 2,
  },
});
