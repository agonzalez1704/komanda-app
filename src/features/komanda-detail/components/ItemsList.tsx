import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Divider, Text } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import type { KomandaItemWithMods } from '../hooks/useKomandaDetail';
import { color, fontWeight, hitSlop, palette, radius, space } from '@/theme/tokens';

export function ItemsList({
  items,
  closed,
  onRemove,
}: {
  items: KomandaItemWithMods[];
  closed: boolean;
  onRemove: (id: string) => void;
}) {
  const lineCount = items.length;
  const itemCount = items.reduce((a, it) => a + it.quantity, 0);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="label">Items</Text>
        {lineCount > 0 ? (
          <Text variant="caption">
            {lineCount} line{lineCount === 1 ? '' : 's'} · {itemCount} unit
            {itemCount === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>
      <Card padded={false}>
        {lineCount === 0 ? <EmptyItems /> : (
          items.map((it, idx) => (
            <View key={it.id}>
              <ItemRow
                item={it}
                closed={closed}
                onRemove={() => onRemove(it.id)}
              />
              {idx < lineCount - 1 ? (
                <Divider style={{ marginLeft: 60 }} />
              ) : null}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

function EmptyItems() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="fast-food-outline" size={22} color={palette.terracotta500} />
      </View>
      <Text variant="bodyStrong" align="center">
        No items yet
      </Text>
      <Text variant="footnote" align="center" style={{ maxWidth: 240 }}>
        Tap &ldquo;Add first item&rdquo; below to start building this order.
      </Text>
    </View>
  );
}

function ItemRow({
  item,
  closed,
  onRemove,
}: {
  item: KomandaItemWithMods;
  closed: boolean;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.qty}>
        <Text style={styles.qtyNum}>{item.quantity}</Text>
        <Text style={styles.qtyX}>×</Text>
      </View>
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {item.product_name_snapshot}
        </Text>
        {item.variant_name_snapshot ? (
          <Text variant="footnote">{item.variant_name_snapshot}</Text>
        ) : null}
        {item.modifiers.length > 0 ? (
          <Text variant="caption" numberOfLines={2}>
            {item.modifiers.map((m) => m.name_snapshot).join(' · ')}
          </Text>
        ) : null}
        {item.note_text ? (
          <Text
            variant="caption"
            style={{ fontStyle: 'italic', color: palette.ink500 }}
          >
            &ldquo;{item.note_text}&rdquo;
          </Text>
        ) : null}
      </View>
      <View style={styles.priceCol}>
        <Text variant="bodyStrong" mono style={{ fontSize: 15 }}>
          {formatMXN(item.quantity * item.unit_price_cents)}
        </Text>
        {item.quantity > 1 ? (
          <Text variant="caption" mono>
            {formatMXN(item.unit_price_cents)} ea
          </Text>
        ) : null}
      </View>
      {!closed ? (
        <Pressable
          onPress={onRemove}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Remove item"
          style={({ pressed }) => [
            styles.remove,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="close" size={16} color={color.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  qty: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  qtyNum: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: color.primary,
    fontVariant: ['tabular-nums'],
  },
  qtyX: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: color.primary,
    marginTop: -2,
  },
  body: { flex: 1, gap: 2 },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  remove: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.dangerBg,
  },
  empty: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.xs,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: palette.terracotta50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
