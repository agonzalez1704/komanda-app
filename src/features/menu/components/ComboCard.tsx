import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Text } from '@/components/ui';
import { color, fontWeight, palette, radius, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';
import type { ComboRowT } from '@/insforge/schemas';

export function ComboCard({
  combo,
  itemCount,
  onPress,
}: {
  combo: ComboRowT;
  itemCount: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit combo ${combo.name}, ${formatMXN(combo.price_cents)}${
        !combo.active ? ', hidden' : ''
      }`}
      style={({ pressed }) => [
        pressed && { opacity: 0.95, transform: [{ scale: 0.995 }] },
      ]}
    >
      <Card padded={false}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="layers" size={22} color={palette.terracotta600} />
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text
                variant="bodyStrong"
                numberOfLines={1}
                style={[
                  { flex: 1 },
                  !combo.active && { color: color.textSecondary },
                ]}
              >
                {combo.name}
              </Text>
              {!combo.active ? (
                <View style={styles.hiddenBadge}>
                  <Text variant="caption" style={{ color: color.warningText }}>
                    Hidden
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.metaRow}>
              <Text
                mono
                style={{
                  fontSize: 15,
                  fontWeight: fontWeight.bold,
                  color: palette.terracotta600,
                }}
              >
                {formatMXN(combo.price_cents)}
              </Text>
              {itemCount > 0 ? (
                <>
                  <View style={styles.dot} />
                  <Text variant="footnote">
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />
        </View>
      </Card>
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
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.terracotta100,
  },
  body: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: color.textTertiary,
  },
  hiddenBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: color.warningBg,
  },
});
