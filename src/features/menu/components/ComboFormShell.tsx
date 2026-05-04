import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Divider,
  GlassSurface,
  IconButton,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import {
  color,
  fontWeight,
  hitSlop,
  palette,
  radius,
  space,
} from '@/theme/tokens';
import { useUpsertCombo } from '@/mutations/useUpsertCombo';
import { useDeleteCombo } from '@/mutations/useDeleteCombo';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { ComboItemPicker } from './ComboItemPicker';
import type { ComboItemRowT, ComboRowT } from '@/insforge/schemas';
import { formatMXN } from '@/domain/money';

type DraftItem = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
};

export function ComboFormShell({
  initial,
  productNames,
  variantNames,
}: {
  initial?: { combo: ComboRowT; items: ComboItemRowT[] };
  productNames: Record<string, string>;
  variantNames: Record<string, string | null>;
}) {
  const router = useRouter();
  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';
  const upsert = useUpsertCombo(orgId);
  const remove = useDeleteCombo(orgId);

  const isNew = !initial;
  const [name, setName] = useState(initial?.combo.name ?? '');
  const [category, setCategory] = useState(
    initial?.combo.category ?? 'Combos',
  );
  const [priceInput, setPriceInput] = useState(
    initial ? centsToInput(initial.combo.price_cents) : '',
  );
  const [active, setActive] = useState(initial?.combo.active ?? true);
  const [items, setItems] = useState<DraftItem[]>(
    initial
      ? initial.items.map((it) => ({
          product_id: it.product_id,
          variant_id: it.variant_id,
          quantity: it.quantity,
        }))
      : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceCents = useMemo(() => parsePrice(priceInput), [priceInput]);

  function addItem(it: DraftItem) {
    setItems((prev) => [...prev, it]);
    setPickerOpen(false);
  }

  function bumpQty(idx: number, delta: number) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, quantity: Math.max(1, Math.min(99, it.quantity + delta)) }
          : it,
      ),
    );
  }

  function removeAt(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (priceCents === null || priceCents <= 0) {
      setError('Price must be greater than zero.');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one product.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await upsert.mutateAsync({
        id: initial?.combo.id,
        name: name.trim(),
        category: category.trim() || 'Combos',
        price_cents: priceCents,
        active,
        sort_order: initial?.combo.sort_order ?? 0,
        items: items.map((it, idx) => ({
          product_id: it.product_id,
          variant_id: it.variant_id,
          quantity: it.quantity,
          sort_order: idx,
        })),
      });
      router.back();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save combo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onDelete() {
    if (!initial) return;
    Alert.alert(
      'Delete combo?',
      "It won't be available on new komandas. Past komandas keep their records.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove.mutateAsync(initial.combo.id);
              router.back();
            } catch (e) {
              Alert.alert(
                'Could not delete',
                e instanceof Error ? e.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }

  return (
    <Screen
      scrollable
      padded={false}
      avoidKeyboard
      floatingFooter
      contentContainerStyle={{ paddingBottom: 160 }}
      footer={
        <GlassSurface radius={radius.xxl} contentStyle={styles.actionBar}>
          <Button
            label="Cancel"
            variant="ghost"
            haptic={false}
            onPress={() => router.back()}
            style={{ flex: 0.8 }}
          />
          <Button
            label={isNew ? 'Create combo' : 'Save changes'}
            onPress={save}
            disabled={submitting}
            loading={submitting}
            leadingIcon={
              <Ionicons
                name={isNew ? 'add' : 'checkmark'}
                size={20}
                color={color.primaryOn}
              />
            }
            style={{ flex: 1.4 }}
          />
        </GlassSurface>
      }
    >
      <View style={styles.hdrPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.hdrInner}>
          <IconButton
            glass
            name="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <View style={{ flex: 1, paddingLeft: space.xs }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: color.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              {isNew ? 'New combo' : 'Edit combo'}
            </Text>
            <Text variant="h3" numberOfLines={1}>
              {name.trim() || (isNew ? 'New combo' : 'Combo')}
            </Text>
          </View>
        </GlassSurface>
      </View>

      <View style={styles.body}>
        <Card>
          <Text variant="label" style={{ marginBottom: space.md }}>
            Details
          </Text>
          <View style={{ gap: space.md }}>
            <TextField
              label="Name"
              placeholder="e.g. Combo Familiar"
              value={name}
              onChangeText={setName}
              required
              autoCapitalize="sentences"
            />
            <TextField
              label="Category"
              placeholder="Combos"
              value={category}
              onChangeText={setCategory}
              autoCapitalize="words"
            />
            <View style={styles.priceSwitchRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Price"
                  placeholder="0.00"
                  value={priceInput}
                  onChangeText={(v) =>
                    setPriceInput(v.replace(/[^0-9.]/g, ''))
                  }
                  keyboardType="decimal-pad"
                  leading="$"
                  trailing={
                    <Text
                      variant="footnote"
                      style={{ color: color.textTertiary }}
                    >
                      MXN
                    </Text>
                  }
                  required
                />
              </View>
              <View style={styles.visibilityBlock}>
                <Text variant="label">Visible</Text>
                <Switch
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ true: color.primary, false: color.border }}
                  thumbColor={color.surface}
                />
              </View>
            </View>
          </View>
        </Card>

        <Card padded={false}>
          <View style={styles.itemsHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="label">Products</Text>
              <Text variant="footnote">
                {items.length === 0
                  ? 'Add the products bundled in this combo'
                  : `${items.length} product${items.length === 1 ? '' : 's'}`}
              </Text>
            </View>
            <View style={[styles.countPill]}>
              <Text
                variant="footnote"
                style={{
                  color: items.length === 0
                    ? color.textTertiary
                    : color.primary,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {items.length}
              </Text>
            </View>
          </View>
          <Divider />
          {items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Text variant="bodySm" align="center">
                No products yet.{'\n'}Tap below to add one.
              </Text>
            </View>
          ) : (
            items.map((it, idx) => {
              const productName =
                productNames[it.product_id] ?? 'Unknown product';
              const variantName = it.variant_id
                ? variantNames[it.variant_id] ?? null
                : null;
              return (
                <View key={`${it.product_id}-${it.variant_id ?? 'base'}-${idx}`}>
                  <View style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" numberOfLines={1}>
                        {productName}
                      </Text>
                      {variantName ? (
                        <Text variant="caption" numberOfLines={1}>
                          {variantName}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => bumpQty(idx, -1)}
                        style={styles.stepBtn}
                        hitSlop={hitSlop}
                        accessibilityLabel="Decrease quantity"
                      >
                        <Ionicons
                          name="remove"
                          size={14}
                          color={color.textPrimary}
                        />
                      </Pressable>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: fontWeight.bold,
                          minWidth: 22,
                          textAlign: 'center',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {it.quantity}
                      </Text>
                      <Pressable
                        onPress={() => bumpQty(idx, +1)}
                        style={styles.stepBtnPlus}
                        hitSlop={hitSlop}
                        accessibilityLabel="Increase quantity"
                      >
                        <Ionicons name="add" size={14} color={palette.ink900} />
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => removeAt(idx)}
                      hitSlop={hitSlop}
                      accessibilityRole="button"
                      accessibilityLabel="Remove product"
                      style={({ pressed }) => [
                        styles.removeBtn,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Ionicons name="close" size={14} color={color.danger} />
                    </Pressable>
                  </View>
                  {idx < items.length - 1 ? (
                    <Divider style={{ marginLeft: space.lg }} />
                  ) : null}
                </View>
              );
            })
          )}
          <Divider />
          <View style={styles.addRow}>
            <Button
              label="+ Add product"
              variant="secondary"
              onPress={() => setPickerOpen(true)}
              size="md"
            />
          </View>
        </Card>

        {priceCents !== null && priceCents > 0 ? (
          <View style={styles.summary}>
            <Text variant="footnote">Combo price</Text>
            <Text
              mono
              style={{
                fontSize: 18,
                fontWeight: fontWeight.bold,
                color: palette.terracotta600,
              }}
            >
              {formatMXN(priceCents)}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle"
              size={16}
              color={color.danger}
            />
            <Text
              variant="footnote"
              style={{ color: color.danger, flex: 1 }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {!isNew ? (
          <Button
            label="Delete combo"
            variant="ghost"
            onPress={onDelete}
            leadingIcon={
              <Ionicons name="trash-outline" size={18} color={color.danger} />
            }
          />
        ) : null}
      </View>

      <ComboItemPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addItem}
      />
    </Screen>
  );
}

function centsToInput(cents: number): string {
  const major = Math.trunc(cents / 100);
  const minor = cents % 100;
  return minor === 0 ? String(major) : `${major}.${String(minor).padStart(2, '0')}`;
}

function parsePrice(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

const styles = StyleSheet.create({
  hdrPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  hdrInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 60,
  },
  actionBar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.lg,
  },
  priceSwitchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
  },
  visibilityBlock: {
    alignItems: 'center',
    gap: space.xs,
    paddingBottom: space.xs,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
  },
  countPill: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: space.sm,
    borderRadius: radius.full,
    backgroundColor: color.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyItems: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: palette.saffron500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.dangerBg,
  },
  addRow: {
    padding: space.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.dangerBg,
    borderRadius: radius.md,
  },
});
