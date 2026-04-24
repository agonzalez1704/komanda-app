import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchProductById,
  fetchVariantsForProduct,
} from '@/insforge/queries/menu';
import type { ProductRowT, VariantRowT } from '@/insforge/schemas';
import { useUpsertProduct } from '@/mutations/useUpsertProduct';
import { useDeleteProduct } from '@/mutations/useDeleteProduct';
import { useUpsertVariant } from '@/mutations/useUpsertVariant';
import { useDeleteVariant } from '@/mutations/useDeleteVariant';
import { useQueueSnapshot } from '@/offline/useQueueSnapshot';
import {
  Button,
  Card,
  Chip,
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
  shadow,
  space,
} from '@/theme/tokens';

export default function ProductEdit() {
  const {
    id,
    name: prefillName,
    returnTo,
  } = useLocalSearchParams<{ id: string; name?: string; returnTo?: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const qc = useQueryClient();

  const cached = qc.getQueryData<ProductRowT>(['product', id]);
  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProductById(id!),
    enabled: !!id && !isNew && !cached,
    initialData: cached,
  });
  const variants = useQuery({
    queryKey: ['variants', 'forProduct', id],
    queryFn: () => fetchVariantsForProduct(id!),
    enabled: !!id && !isNew,
  });

  const upsertProduct = useUpsertProduct();
  const deleteProduct = useDeleteProduct();
  const upsertVariant = useUpsertVariant();
  const deleteVariant = useDeleteVariant();

  const queue = useQueueSnapshot();
  const pendingVariantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of queue) {
      if (m.type === 'upsert_variant') {
        const p = m.payload as { variant_id?: string; product_id?: string };
        if (p?.variant_id && p.product_id === id) ids.add(p.variant_id);
      } else if (m.type === 'delete_variant') {
        const p = m.payload as { variant_id?: string };
        if (p?.variant_id) ids.add(p.variant_id);
      }
    }
    return ids;
  }, [queue, id]);
  const hasPendingVariants = pendingVariantIds.size > 0;

  // Suggest existing categories for quick-pick. Sourced from whatever the
  // menu list screen has already cached; no extra fetch needed.
  const allProducts = qc.getQueryData<ProductRowT[]>(['products', 'all']) ?? [];
  const knownCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      const c = p.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  const row = product.data ?? cached ?? null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [active, setActive] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVariantName, setNewVariantName] = useState('');
  const [categoryMode, setCategoryMode] = useState<'pick' | 'type'>('pick');

  useEffect(() => {
    if (!row) {
      // For brand-new products, honor a `?name=` prefill so entry points
      // elsewhere (e.g. add-item's empty-search "Save to menu") can seed
      // the form without the user retyping.
      if (isNew && prefillName) {
        setName(prefillName);
        setDirty(true);
      }
      return;
    }
    setName(row.name);
    setCategory(row.category);
    setPriceInput(centsToInput(row.price_cents));
    setActive(row.active);
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the current category isn't in the known list, fall into free-text mode
  // so users aren't stuck without a way to edit it.
  useEffect(() => {
    if (category && !knownCategories.includes(category)) {
      setCategoryMode('type');
    }
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeVariants = useMemo(
    () => (variants.data ?? []).filter((v) => v.active),
    [variants.data],
  );

  const priceCents = useMemo(() => parsePrice(priceInput), [priceInput]);
  const canSave = name.trim().length > 0 && priceCents !== null && priceCents >= 0 && dirty;

  async function onSave() {
    if (priceCents === null) {
      setError('Enter a valid price, e.g. 45 or 45.50');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const saved = await upsertProduct.mutateAsync({
        id: isNew ? undefined : id!,
        name: name.trim(),
        category: category.trim() || 'Other',
        price_cents: priceCents,
        active,
        sort_order: row?.sort_order ?? 0,
      });
      setDirty(false);
      if (isNew) {
        // If an upstream flow (e.g. add-item's "Save to menu") asked us to
        // return somewhere specific, honor that instead of landing on the
        // product editor. The product has been optimistically added to the
        // menu cache so it's already visible in the add-item grid.
        if (returnTo) {
          router.replace(returnTo as any);
        } else {
          router.replace(`/(app)/menu/product/${saved.id}`);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not save product');
    } finally {
      setSubmitting(false);
    }
  }

  function onDelete() {
    Alert.alert(
      'Hide product?',
      "It will disappear from the add-item flow, but past komandas keep their records.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct.mutateAsync(id!);
            router.back();
          },
        },
      ],
    );
  }

  async function addVariant() {
    const trimmed = newVariantName.trim();
    if (!trimmed || isNew) return;
    setNewVariantName('');
    const next = activeVariants.length;
    await upsertVariant.mutateAsync({
      product_id: id!,
      name: trimmed,
      active: true,
      sort_order: next,
    });
  }

  async function removeVariant(v: VariantRowT) {
    await deleteVariant.mutateAsync({ variant_id: v.id, product_id: id! });
  }

  if (!isNew && !row && product.isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const heroName = name.trim() || (isNew ? 'New product' : 'Untitled');
  const heroNameMuted = !name.trim();
  const heroPriceText = priceCents !== null ? formatPesos(priceCents) : '—';
  const variantCount = activeVariants.length;

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
            label={isNew ? 'Create product' : 'Save changes'}
            onPress={onSave}
            disabled={!canSave}
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
      {/* Floating glass nav pill — back chevron + eyebrow/title. */}
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
              {isNew ? 'Add to menu' : 'Menu'}
            </Text>
            <Text variant="h3" numberOfLines={1}>
              {isNew ? 'New product' : 'Edit product'}
            </Text>
          </View>
        </GlassSurface>
      </View>

      {/* Hero: live preview of what's being edited. Mirrors how it will
          appear on the menu list so edits feel tangible. */}
      <View style={styles.heroWrap}>
        <View style={styles.hero}>
          <View style={styles.heroStripe} />
          <View style={styles.heroContent}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text
                variant="display"
                numberOfLines={2}
                style={[
                  styles.heroName,
                  heroNameMuted && { color: color.textTertiary },
                ]}
              >
                {heroName}
              </Text>
              <View style={styles.heroMetaRow}>
                {category.trim() ? (
                  <View style={styles.heroCategory}>
                    <View style={styles.heroCategoryDot} />
                    <Text variant="footnote" style={styles.heroCategoryText}>
                      {category.trim()}
                    </Text>
                  </View>
                ) : null}
                {!isNew && !active ? (
                  <View style={styles.heroHidden}>
                    <Ionicons
                      name="eye-off-outline"
                      size={12}
                      color={color.textSecondary}
                    />
                    <Text variant="footnote" style={{ color: color.textSecondary }}>
                      Hidden
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.heroPriceBlock}>
              <Text variant="caption" style={styles.heroPriceLabel}>
                PRICE
              </Text>
              <View style={styles.heroPriceRow}>
                <Text style={styles.heroPriceCurrency}>$</Text>
                <Text style={styles.heroPrice} mono>
                  {heroPriceText}
                </Text>
              </View>
              <Text variant="caption" style={{ color: color.textTertiary }}>
                MXN
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Card>
          <Text variant="label" style={styles.cardLabel}>
            Details
          </Text>
          <View style={{ gap: space.md }}>
            <TextField
              label="Name"
              placeholder="e.g. Taco al pastor"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setDirty(true);
              }}
              required
              autoCapitalize="sentences"
            />

            <View style={{ gap: space.sm }}>
              <View style={styles.rowBetween}>
                <Text variant="label">Category</Text>
                {categoryMode === 'type' && knownCategories.length > 0 ? (
                  <Pressable
                    onPress={() => setCategoryMode('pick')}
                    hitSlop={hitSlop}
                  >
                    <Text variant="footnote" style={{ color: color.primary }}>
                      Pick from list
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {categoryMode === 'pick' && knownCategories.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  {knownCategories.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      selected={category === c}
                      tone="neutral"
                      onPress={() => {
                        setCategory(c);
                        setDirty(true);
                      }}
                    />
                  ))}
                  <Chip
                    label="+ New"
                    tone="neutral"
                    onPress={() => setCategoryMode('type')}
                  />
                </ScrollView>
              ) : (
                <TextField
                  placeholder="e.g. Tacos, Bebidas, Postres"
                  value={category}
                  onChangeText={(v) => {
                    setCategory(v);
                    setDirty(true);
                  }}
                  autoCapitalize="words"
                />
              )}
            </View>

            <View style={styles.priceSwitchRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Price"
                  placeholder="0.00"
                  value={priceInput}
                  onChangeText={(v) => {
                    setPriceInput(v.replace(/[^0-9.]/g, ''));
                    setDirty(true);
                  }}
                  keyboardType="decimal-pad"
                  leading="$"
                  trailing={
                    <Text variant="footnote" style={{ color: color.textTertiary }}>
                      MXN
                    </Text>
                  }
                  error={error}
                  required
                />
              </View>
              <View style={styles.visibilityBlock}>
                <Text variant="label">Visible</Text>
                <Switch
                  value={active}
                  onValueChange={(v) => {
                    setActive(v);
                    setDirty(true);
                  }}
                  trackColor={{ true: color.primary, false: color.border }}
                  thumbColor={color.surface}
                />
              </View>
            </View>
          </View>
        </Card>

        {!isNew ? (
          <Card padded={false}>
            <View style={styles.variantsHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="label">Variants</Text>
                <Text variant="footnote">
                  {variantCount === 0
                    ? 'Sizes, preparations, or styles'
                    : variantCount === 1
                    ? '1 option available'
                    : `${variantCount} options available`}
                </Text>
              </View>
              <View style={styles.variantsHeaderRight}>
                {hasPendingVariants ? (
                  <View style={styles.syncBadge} accessibilityLiveRegion="polite">
                    <ActivityIndicator size="small" color={color.textSecondary} />
                    <Text variant="footnote" style={{ color: color.textSecondary }}>
                      Syncing
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.countPill,
                    variantCount === 0 && styles.countPillEmpty,
                  ]}
                >
                  <Text
                    variant="footnote"
                    style={{
                      color: variantCount === 0 ? color.textTertiary : color.primary,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {variantCount}
                  </Text>
                </View>
              </View>
            </View>
            <Divider />
            {activeVariants.length === 0 ? (
              <View style={styles.emptyVariants}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="pricetags-outline"
                    size={20}
                    color={color.textTertiary}
                  />
                </View>
                <Text variant="bodySm" align="center">
                  No variants yet. Add sizes, styles, or
                  {'\n'}preparations to offer more options.
                </Text>
              </View>
            ) : (
              activeVariants.map((v, idx, arr) => {
                const pending = pendingVariantIds.has(v.id);
                return (
                  <View key={v.id}>
                    <View
                      style={[styles.variantRow, pending && styles.variantRowPending]}
                    >
                      <View style={styles.variantIndex}>
                        {pending ? (
                          <ActivityIndicator size="small" color={color.textTertiary} />
                        ) : (
                          <Text
                            variant="caption"
                            style={{ color: color.textTertiary }}
                          >
                            {idx + 1}
                          </Text>
                        )}
                      </View>
                      <Text variant="body" style={{ flex: 1 }}>
                        {v.name}
                      </Text>
                      <Pressable
                        onPress={() => removeVariant(v)}
                        disabled={pending}
                        hitSlop={hitSlop}
                        style={({ pressed }) => [
                          styles.removeBtn,
                          pending && styles.removeBtnDisabled,
                          pressed && !pending && { opacity: 0.6 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: pending }}
                        accessibilityLabel={`Remove variant ${v.name}`}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={pending ? color.textTertiary : color.danger}
                        />
                      </Pressable>
                    </View>
                    {idx < arr.length - 1 ? (
                      <Divider style={{ marginLeft: space.xxxl + space.sm }} />
                    ) : null}
                  </View>
                );
              })
            )}
            <Divider />
            <View style={styles.addVariantRow}>
              <TextField
                placeholder="Add a variant…"
                value={newVariantName}
                onChangeText={setNewVariantName}
                onSubmitEditing={addVariant}
                returnKeyType="done"
                containerStyle={{ flex: 1 }}
              />
              <Button
                label="Add"
                size="md"
                variant="secondary"
                fullWidth={false}
                onPress={addVariant}
                disabled={!newVariantName.trim() || upsertVariant.isPending}
                loading={upsertVariant.isPending}
              />
            </View>
          </Card>
        ) : (
          <View style={styles.hint}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={color.textSecondary}
            />
            <Text variant="footnote" style={{ flex: 1 }}>
              Save the product first to add variants like sizes or preparations.
            </Text>
          </View>
        )}

        {!isNew ? (
          <Button
            label="Hide product"
            variant="ghost"
            onPress={onDelete}
            leadingIcon={
              <Ionicons name="eye-off-outline" size={18} color={color.primary} />
            }
          />
        ) : null}
      </View>
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

function formatPesos(cents: number): string {
  const major = Math.trunc(cents / 100);
  const minor = cents % 100;
  const majorStr = major.toLocaleString('en-US');
  return `${majorStr}.${String(minor).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Floating glass nav — inset so WarmCanvas wraps the corners.
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

  // Glass footer action bar — paired Cancel / Save CTA.
  actionBar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },

  // Hero
  heroWrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  hero: {
    flexDirection: 'row',
    backgroundColor: palette.bone,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    ...shadow.sm,
  },
  heroStripe: {
    width: 6,
    backgroundColor: palette.saffron500,
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    gap: space.lg,
  },
  heroName: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  heroCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: palette.saffron50,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  heroCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: palette.saffron500,
  },
  heroCategoryText: {
    color: palette.saffron600,
    fontWeight: fontWeight.semibold,
  },
  heroHidden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.surfaceAlt,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  heroPriceBlock: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 96,
  },
  heroPriceLabel: {
    color: color.textTertiary,
    letterSpacing: 0.8,
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  heroPriceCurrency: {
    fontSize: 18,
    fontWeight: fontWeight.semibold,
    color: color.primary,
  },
  heroPrice: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: fontWeight.heavy,
    color: color.primary,
    letterSpacing: -0.5,
  },

  // Body
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.lg,
  },
  cardLabel: {
    marginBottom: space.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipScroll: {
    gap: space.sm,
    paddingVertical: 2,
    paddingRight: space.sm,
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

  // Variants
  variantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
  },
  variantsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
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
  countPillEmpty: {
    backgroundColor: color.surfaceAlt,
  },
  emptyVariants: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  variantRowPending: {
    opacity: 0.6,
  },
  variantIndex: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.dangerBg,
  },
  removeBtnDisabled: {
    backgroundColor: color.surfaceAlt,
  },
  addVariantRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.md,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
  },
});
