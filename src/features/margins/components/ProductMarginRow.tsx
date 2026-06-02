import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';

export type ProductMarginRowProps = {
  name: string;
  category?: string;
  inStorePriceCents: number;
  uberPriceCents: number;
  marginCents: number;          // in-store margin (primary indicator)
  /** When true, the row shows a "missing recipe" affordance instead of margin. */
  missingRecipe?: boolean;
  onPress?: () => void;
};

export function ProductMarginRow({
  name,
  category,
  inStorePriceCents,
  uberPriceCents,
  marginCents,
  missingRecipe,
  onPress,
}: ProductMarginRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} margin`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{name}</Text>
        {category ? <Text variant="footnote">{category}</Text> : null}
        <View style={styles.priceLine}>
          <Text variant="caption">
            In-store {formatMXN(inStorePriceCents)} · Uber {formatMXN(uberPriceCents)}
          </Text>
        </View>
      </View>
      <View style={styles.marginCol}>
        {missingRecipe ? (
          <View style={styles.warnPill}>
            <Ionicons name="alert-circle-outline" size={14} color={color.warning} />
            <Text variant="footnote" style={{ color: color.warning }}>
              No recipe
            </Text>
          </View>
        ) : (
          <Text style={[styles.margin, marginCents < 0 && { color: color.danger }]}>
            {formatMXN(marginCents)}
          </Text>
        )}
        <Text variant="footnote">margin</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  priceLine: {
    marginTop: space.xs,
  },
  marginCol: {
    alignItems: 'flex-end',
  },
  margin: {
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
  },
  warnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: color.warningBg,
  },
});
