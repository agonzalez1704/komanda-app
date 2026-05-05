import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Text } from '@/components/ui';
import { color, fontWeight, palette, radius, space } from '@/theme/tokens';
import { fetchAllProducts, fetchAllVariants } from '@/insforge/queries/menu';
import { formatMXN } from '@/domain/money';
import type { ProductRowT, VariantRowT } from '@/insforge/schemas';

export type ComboItemPickResult = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
};

export function ComboItemPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (item: ComboItemPickResult) => void;
}) {
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: fetchAllProducts,
  });
  const variants = useQuery({
    queryKey: ['variants', 'all'],
    queryFn: fetchAllVariants,
  });

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{
    product: ProductRowT;
    variant: VariantRowT | null;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);

  const filtered = useMemo(() => {
    const all = (products.data ?? []).filter((p) => p.active);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    );
  }, [products.data, search]);

  function variantsFor(product: ProductRowT): VariantRowT[] {
    return (variants.data ?? []).filter(
      (v) => v.product_id === product.id && v.active,
    );
  }

  function reset() {
    setSelected(null);
    setQuantity(1);
    setSearch('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pick(p: ProductRowT, v: VariantRowT | null) {
    setSelected({ product: p, variant: v });
  }

  function confirm() {
    if (!selected) return;
    onPick({
      product_id: selected.product.id,
      variant_id: selected.variant?.id ?? null,
      quantity,
    });
    reset();
  }

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.backdrop}
      pointerEvents="box-none"
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text variant="h3">Add to combo</Text>
          {selected ? (
            <Pressable
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="Pick a different product"
              hitSlop={12}
            >
              <Text variant="bodySm" style={{ color: color.primary }}>
                Change
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!selected ? (
          <>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={color.textTertiary} />
              <TextInput
                placeholder="Search products"
                placeholderTextColor={color.textTertiary}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            <ScrollView
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ gap: space.xs, paddingBottom: space.md }}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.map((p) => {
                const vs = variantsFor(p);
                // No variants: single tap = pick product.
                if (vs.length === 0) {
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => pick(p, null)}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text variant="caption">{p.category}</Text>
                      </View>
                      <Text mono style={styles.price}>
                        {formatMXN(p.price_cents)}
                      </Text>
                    </Pressable>
                  );
                }
                // With variants: product itself is the default pick (any
                // variant). Variants below are optional, indented sub-picks
                // for when a combo really must lock a specific one.
                return (
                  <View key={p.id} style={styles.productGroup}>
                    <Pressable
                      onPress={() => pick(p, null)}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text variant="caption">
                          {p.category} · cualquier variante
                        </Text>
                      </View>
                      <Text mono style={styles.price}>
                        {formatMXN(p.price_cents)}
                      </Text>
                    </Pressable>
                    {vs.map((v) => (
                      <Pressable
                        key={v.id}
                        onPress={() => pick(p, v)}
                        style={({ pressed }) => [
                          styles.row,
                          styles.rowChild,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text variant="body" numberOfLines={1}>
                            ↳ {v.name}
                          </Text>
                        </View>
                        <Text mono style={styles.price}>
                          {formatMXN(p.price_cents)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
              {filtered.length === 0 ? (
                <View style={{ padding: space.lg }}>
                  <Text variant="footnote" align="center">
                    No products match.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </>
        ) : (
          <View style={{ gap: space.lg }}>
            <View style={styles.selectedCard}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {selected.product.name}
              </Text>
              <Text variant="footnote">
                {selected.variant
                  ? selected.variant.name
                  : variantsFor(selected.product).length > 0
                    ? 'Cualquier variante'
                    : selected.product.category}
              </Text>
              <Text mono style={styles.price}>
                {formatMXN(selected.product.price_cents)}
              </Text>
            </View>

            <View style={styles.qtyRow}>
              <Text variant="label">Quantity in this combo</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  style={styles.stepBtn}
                  accessibilityLabel="Decrease quantity"
                >
                  <Ionicons name="remove" size={16} color={color.textPrimary} />
                </Pressable>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: fontWeight.bold,
                    minWidth: 28,
                    textAlign: 'center',
                  }}
                >
                  {quantity}
                </Text>
                <Pressable
                  onPress={() => setQuantity((q) => Math.min(99, q + 1))}
                  style={styles.stepBtn}
                  accessibilityLabel="Increase quantity"
                >
                  <Ionicons name="add" size={16} color={palette.ink900} />
                </Pressable>
              </View>
            </View>

            <Button
              label={`Add ${quantity}× to combo`}
              onPress={confirm}
              leadingIcon={
                <Ionicons name="checkmark" size={18} color={color.primaryOn} />
              }
            />
          </View>
        )}

        <Pressable onPress={handleClose} style={styles.dismiss}>
          <Text variant="bodySm" align="center">
            Cancel
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0006',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
    alignSelf: 'center',
    marginVertical: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    height: 44,
    marginBottom: space.sm,
  },
  searchInput: {
    flex: 1,
    color: color.textPrimary,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  productGroup: { gap: space.xs, paddingTop: space.xs },
  rowChild: {
    marginLeft: space.lg,
    backgroundColor: color.surfaceAlt,
  },
  price: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: palette.terracotta600,
  },
  selectedCard: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: palette.saffron50,
    borderWidth: 1,
    borderColor: palette.saffron500,
    gap: space.xs,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceAlt,
  },
  dismiss: {
    paddingVertical: space.md,
  },
});
