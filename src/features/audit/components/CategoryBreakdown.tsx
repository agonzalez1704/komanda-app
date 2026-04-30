import { StyleSheet, View } from 'react-native';
import { Card, Divider, Text } from '@/components/ui';
import { space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';

type Props = {
  title: string;
  byCategory: Record<string, number>;
};

export function CategoryBreakdown({ title, byCategory }: Props) {
  const entries = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

  return (
    <View style={styles.wrap}>
      <Text variant="label">{title}</Text>
      <Card padded={false}>
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="bodySm">Nothing yet.</Text>
          </View>
        ) : (
          entries.map(([name, amount], idx) => (
            <View key={name}>
              {idx > 0 ? <Divider style={{ marginLeft: space.lg }} /> : null}
              <View style={styles.row}>
                <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {name}
                </Text>
                <Text mono variant="bodyStrong">
                  {formatMXN(amount)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  empty: {
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
