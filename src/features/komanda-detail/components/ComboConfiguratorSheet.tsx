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
import { Button, Chip, Text } from '@/components/ui';
import { color, fontWeight, palette, radius, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';
import type {
  ComboItemRowT,
  ComboRowT,
  ModifierRowT,
  ProductRowT,
  VariantRowT,
} from '@/insforge/schemas';

export type ChildOverride = {
  note_text: string | null;
  modifiers: { modifier_id: string | null; name_snapshot: string }[];
};

export type ComboConfiguratorSheetProps = {
  combo: ComboRowT;
  composition: ComboItemRowT[];
  products: ProductRowT[];
  modifiers: ModifierRowT[];
  variants: VariantRowT[];
  onClose: () => void;
  onConfirm: (overrides: Record<string, ChildOverride>) => void;
};

export function ComboConfiguratorSheet({
  combo,
  composition,
  products,
  modifiers,
  variants,
  onClose,
  onConfirm,
}: ComboConfiguratorSheetProps) {
  const [overrides, setOverrides] = useState<Record<string, ChildOverride>>(
    () => {
      const init: Record<string, ChildOverride> = {};
      for (const ci of composition) {
        init[ci.id] = { note_text: null, modifiers: [] };
      }
      return init;
    },
  );

  const productById = useMemo(() => {
    const m = new Map<string, ProductRowT>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);
  const variantById = useMemo(() => {
    const m = new Map<string, VariantRowT>();
    for (const v of variants) m.set(v.id, v);
    return m;
  }, [variants]);

  function toggleMod(itemId: string, mod: ModifierRowT) {
    setOverrides((prev) => {
      const cur = prev[itemId] ?? { note_text: null, modifiers: [] };
      const exists = cur.modifiers.some((m) => m.modifier_id === mod.id);
      const next: ChildOverride = {
        ...cur,
        modifiers: exists
          ? cur.modifiers.filter((m) => m.modifier_id !== mod.id)
          : [...cur.modifiers, { modifier_id: mod.id, name_snapshot: mod.name }],
      };
      return { ...prev, [itemId]: next };
    });
  }

  function setNote(itemId: string, value: string) {
    setOverrides((prev) => {
      const cur = prev[itemId] ?? { note_text: null, modifiers: [] };
      return { ...prev, [itemId]: { ...cur, note_text: value || null } };
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.backdrop}
      pointerEvents="box-none"
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView
          contentContainerStyle={{
            gap: space.md,
            paddingBottom: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="h2" numberOfLines={2}>
                {combo.name}
              </Text>
              <Text variant="footnote">{composition.length} products</Text>
            </View>
            <Text
              mono
              style={{
                fontSize: 18,
                fontWeight: fontWeight.bold,
                color: palette.terracotta600,
              }}
            >
              {formatMXN(combo.price_cents)}
            </Text>
          </View>

          {composition.map((ci) => {
            const product = productById.get(ci.product_id);
            const variant = ci.variant_id ? variantById.get(ci.variant_id) : null;
            const productName = product?.name ?? 'Unknown product';
            const variantName = variant?.name ?? null;
            const cur =
              overrides[ci.id] ?? { note_text: null, modifiers: [] };
            return (
              <View key={ci.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.qtyBubble}>
                    <Text style={styles.qtyText}>{ci.quantity}×</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {productName}
                    </Text>
                    {variantName ? (
                      <Text variant="caption">{variantName}</Text>
                    ) : null}
                  </View>
                </View>

                {modifiers.length > 0 ? (
                  <View style={styles.modSection}>
                    <Text variant="label">Modifiers</Text>
                    <View style={styles.modRow}>
                      {modifiers.map((m) => {
                        const on = cur.modifiers.some(
                          (x) => x.modifier_id === m.id,
                        );
                        return (
                          <Chip
                            key={m.id}
                            label={m.name}
                            selected={on}
                            onPress={() => toggleMod(ci.id, m)}
                          />
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <TextInput
                  value={cur.note_text ?? ''}
                  onChangeText={(v) => setNote(ci.id, v)}
                  placeholder="Note (optional)"
                  placeholderTextColor={color.textTertiary}
                  style={styles.noteInput}
                />
              </View>
            );
          })}

          <Button
            label={`Add combo · ${formatMXN(combo.price_cents)}`}
            onPress={() => onConfirm(overrides)}
            leadingIcon={
              <Ionicons name="add" size={18} color={color.primaryOn} />
            }
          />
          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text variant="bodySm" align="center">
              Cancel
            </Text>
          </Pressable>
        </ScrollView>
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
    maxHeight: '92%',
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
    alignItems: 'flex-start',
    gap: space.md,
    paddingBottom: space.sm,
  },
  itemCard: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    gap: space.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  qtyBubble: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: palette.saffron50,
    borderWidth: 1,
    borderColor: palette.saffron500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: palette.saffron600,
  },
  modSection: { gap: space.xs },
  modRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.textPrimary,
    fontSize: 14,
  },
  dismiss: {
    paddingVertical: space.md,
  },
});
