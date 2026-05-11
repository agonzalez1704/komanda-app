import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import { color, fontWeight, hitSlop, palette, radius, space } from '@/theme/tokens';
import { formatVariantLabel } from '@/domain/variantLabel';

export type ComboGroupChild = {
  id: string;
  quantity: number;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  variant_2_name_snapshot: string | null;
  modifiers?: { name_snapshot: string }[];
  note_text?: string | null;
};

export type ComboGroupProps = {
  combo: {
    id: string;
    name_snapshot: string;
    price_cents_snapshot: number;
  };
  children: ComboGroupChild[];
  tone?: 'light' | 'dark';
  onRemove?: () => void;
};

/**
 * ComboGroup — renders a combo header (bold name + right-aligned price)
 * followed by indented child rows. Children show qty + name + modifiers/note,
 * but no per-row price (the combo header carries the bundle's price).
 *
 * `tone` switches palette so the same component reads correctly inside a
 * light surface (ItemsList) and the dark KomandaTicket gradient.
 */
export function ComboGroup({
  combo,
  children,
  tone = 'light',
  onRemove,
}: ComboGroupProps) {
  const dark = tone === 'dark';
  const styles = dark ? darkStyles : lightStyles;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="layers"
            size={14}
            color={dark ? palette.saffron500 : palette.terracotta600}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={2}>
            {combo.name_snapshot}
          </Text>
          <Text style={styles.headerLabel}>Combo · {children.length} item
            {children.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Text mono style={styles.headerPrice}>
          {formatMXN(combo.price_cents_snapshot)}
        </Text>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`Remove combo ${combo.name_snapshot}`}
            style={({ pressed }) => [
              styles.removeBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name="close"
              size={14}
              color={dark ? '#FFFFFF' : color.danger}
            />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.children}>
        {children.map((c) => {
          const mods = c.modifiers ?? [];
          return (
            <View key={c.id} style={styles.childRow}>
              <Text mono style={styles.childQty}>
                {c.quantity}×
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName} numberOfLines={2}>
                  {c.product_name_snapshot}
                  {formatVariantLabel(c.variant_name_snapshot, c.variant_2_name_snapshot)
                    ? ` · ${formatVariantLabel(c.variant_name_snapshot, c.variant_2_name_snapshot)}`
                    : ''}
                </Text>
                {mods.length > 0 ? (
                  <Text style={styles.childSub} numberOfLines={2}>
                    {mods.map((m) => m.name_snapshot).join(' · ')}
                  </Text>
                ) : null}
                {c.note_text ? (
                  <Text style={[styles.childSub, styles.childNote]} numberOfLines={2}>
                    “{c.note_text}”
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const lightStyles = StyleSheet.create({
  wrap: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: palette.terracotta100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: palette.terracotta600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerPrice: {
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: palette.terracotta600,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.dangerBg,
    marginLeft: space.xs,
  },
  children: {
    gap: 4,
    paddingLeft: 36,
    borderLeftWidth: 2,
    borderLeftColor: palette.terracotta100,
    marginLeft: 14,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingVertical: 4,
  },
  childQty: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: palette.terracotta600,
    minWidth: 26,
  },
  childName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: fontWeight.medium,
    color: color.textPrimary,
  },
  childSub: {
    fontSize: 11,
    lineHeight: 14,
    color: color.textSecondary,
    marginTop: 2,
  },
  childNote: { fontStyle: 'italic' },
});

const darkStyles = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(254,171,48,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: palette.saffron500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerPrice: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginLeft: 4,
  },
  children: {
    gap: 4,
    paddingLeft: 22,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(254,171,48,0.25)',
    marginLeft: 11,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  childQty: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: palette.saffron500,
    minWidth: 22,
  },
  childName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: fontWeight.medium,
    color: '#FFFFFF',
  },
  childSub: {
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  childNote: { fontStyle: 'italic' },
});
