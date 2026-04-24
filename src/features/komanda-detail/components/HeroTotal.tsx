import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import { color, fontWeight, palette, radius, space } from '@/theme/tokens';

export function HeroTotal({
  totalCents,
  itemCount,
  displayName,
}: {
  totalCents: number;
  itemCount: number;
  displayName: string | null | undefined;
}) {
  return (
    <View style={styles.pad}>
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Running total</Text>
          <Text mono style={styles.money}>
            {formatMXN(totalCents)}
          </Text>
          {displayName ? (
            <Text variant="footnote" style={{ marginTop: 2 }}>
              {displayName}
            </Text>
          ) : null}
        </View>
        <View style={styles.chip}>
          <Ionicons name="fast-food" size={14} color={palette.saffron600} />
          <Text mono style={styles.chipCount}>
            {itemCount}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: color.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  money: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: fontWeight.heavy,
    color: color.textPrimary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    backgroundColor: palette.saffron50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.saffron100,
  },
  chipCount: {
    color: palette.terracotta600,
    fontWeight: fontWeight.bold,
    fontSize: 14,
  },
});
