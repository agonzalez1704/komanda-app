import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchProducts, fetchVariants, fetchModifiers } from '@/insforge/queries/menu';
import { QuantityStepper } from '@/components/QuantityStepper';
import { formatMXN } from '@/domain/money';
import { useAddItem } from '@/mutations/useAddItem';
import { announce, useReduceMotion } from '@/hooks/useReduceMotion';
import type { ProductRowT, VariantRowT, ModifierRowT } from '@/insforge/schemas';
import type { KomandaItemRowT, KomandaItemModifierRowT } from '@/insforge/queries/komandas';
import {
  Button,
  Chip,
  EmptyState,
  GlassSurface,
  IconButton,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { color, fontWeight, hitSlop, palette, radius, shadow, space } from '@/theme/tokens';

type CartLine = KomandaItemRowT & { modifiers: KomandaItemModifierRowT[] };
const ALL_CATEGORY = '__all__';

export default function AddItem() {
  const { id: komandaId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const variants = useQuery({ queryKey: ['variants'], queryFn: fetchVariants });
  const modifiers = useQuery({ queryKey: ['modifiers'], queryFn: fetchModifiers });
  const addItem = useAddItem();
  const reduceMotion = useReduceMotion();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [variantSheet, setVariantSheet] = useState<ProductRowT | null>(null);
  const [customizeFor, setCustomizeFor] = useState<
    { product: ProductRowT; variant: VariantRowT | null } | null
  >(null);

  function goCustom(prefill?: { name?: string }) {
    const q = prefill?.name?.trim() ? `?name=${encodeURIComponent(prefill.name.trim())}` : '';
    router.push(`/(app)/komandas/${komandaId}/custom-item${q}`);
  }

  function goNewProduct(prefillName?: string) {
    const trimmed = prefillName?.trim();
    const returnTo = `/(app)/komandas/${komandaId}/add-item`;
    const parts: string[] = [`returnTo=${encodeURIComponent(returnTo)}`];
    if (trimmed) parts.push(`name=${encodeURIComponent(trimmed)}`);
    router.push(`/(app)/menu/product/new?${parts.join('&')}`);
  }

  // Live running cart — whatever the add-item mutation has already optimistically added
  const cart = qc.getQueryData<CartLine[]>(['komanda', komandaId, 'items']) ?? [];
  const cartCount = cart.reduce((acc, it) => acc + it.quantity, 0);
  const cartTotal = cart.reduce((acc, it) => acc + it.quantity * it.unit_price_cents, 0);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products.data ?? []) set.add((p.category || 'Otros').trim() || 'Otros');
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products.data]);

  const filteredProducts = useMemo(() => {
    const all = products.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      const inCategory = category === ALL_CATEGORY || (p.category || 'Otros') === category;
      const inSearch =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      return inCategory && inSearch;
    });
  }, [products.data, category, search]);

  function variantsFor(product: ProductRowT): VariantRowT[] {
    return variants.data?.filter((v) => v.product_id === product.id) ?? [];
  }

  async function quickAddQty(
    product: ProductRowT,
    variant: VariantRowT | null,
    quantity: number,
  ) {
    if (!komandaId || quantity <= 0) return;
    await addItem.mutateAsync({
      komanda_id: komandaId,
      product_id: product.id,
      variant_id: variant?.id ?? null,
      quantity,
      unit_price_cents: product.price_cents,
      product_name_snapshot: product.name,
      variant_name_snapshot: variant?.name ?? null,
      note_text: null,
      modifiers: [],
    });
    // VoiceOver confirmation — spoken only when VO is active
    const label = variant ? `${product.name}, ${variant.name}` : product.name;
    const plural = quantity === 1 ? 'item' : 'items';
    announce(`Added ${quantity} ${label}. Cart has ${quantity} ${plural} more.`);
  }

  async function quickAdd(product: ProductRowT, variant: VariantRowT | null) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await quickAddQty(product, variant, 1);
  }

  function handleProductTap(product: ProductRowT) {
    const vs = variantsFor(product);
    if (vs.length === 0) {
      void quickAdd(product, null);
    } else {
      setVariantSheet(product);
    }
  }

  // Loading state
  if (products.isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const hasProducts = (products.data ?? []).length > 0;
  if (!hasProducts) {
    return (
      <Screen padded={false}>
        <View style={styles.hdrPad}>
          <GlassSurface radius={radius.xxl} contentStyle={styles.hdrInner}>
            <IconButton
              glass
              name="chevron-back"
              onPress={() => router.back()}
              accessibilityLabel="Back"
            />
            <View style={{ flex: 1, paddingLeft: space.xs }}>
              <Text variant="h3" numberOfLines={1}>Add items</Text>
              <Text variant="footnote" numberOfLines={1}>Menu is empty</Text>
            </View>
          </GlassSurface>
        </View>
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="restaurant-outline"
            title="Menu is empty"
            subtitle="Set up your menu, or drop a one-off item into this komanda."
          />
          <View style={{ paddingHorizontal: space.xl, gap: space.sm }}>
            <Button
              label="Set up menu"
              onPress={() => goNewProduct()}
              leadingIcon={<Ionicons name="add" size={20} color={color.primaryOn} />}
            />
            <Button
              label="Add a one-off item"
              variant="secondary"
              onPress={() => goCustom()}
              leadingIcon={
                <Ionicons name="sparkles-outline" size={18} color={color.textPrimary} />
              }
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      padded={false}
      bottomInset={space.sm}
      floatingFooter
      footer={
        <GlassSurface variant="dark" radius={radius.xxl}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Done adding items"
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
            style={({ pressed }) => [
              styles.doneBar,
              pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] },
            ]}
          >
            <View style={styles.doneLeft}>
              <View style={styles.doneCountBubble}>
                <Text
                  style={{
                    color: palette.ink900,
                    fontWeight: fontWeight.heavy,
                    fontSize: 16,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {cartCount}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: 11,
                    fontWeight: fontWeight.semibold,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                  }}
                >
                  {cartCount === 1 ? 'Item' : 'Items'}
                </Text>
                <Text
                  style={{
                    color: palette.white,
                    fontWeight: fontWeight.semibold,
                    fontSize: 15,
                  }}
                >
                  Tap to review
                </Text>
              </View>
            </View>
            <View style={styles.doneRight}>
              <Text
                mono
                style={{
                  color: palette.saffron500,
                  fontWeight: fontWeight.heavy,
                  fontSize: 20,
                  letterSpacing: -0.3,
                }}
              >
                {formatMXN(cartTotal)}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={palette.white} />
            </View>
          </Pressable>
        </GlassSurface>
      }
    >
      {/* Floating glass nav pill */}
      <View style={styles.hdrPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.hdrInner}>
          <IconButton glass name="chevron-back" onPress={() => router.back()} accessibilityLabel="Back" />
          <View style={{ flex: 1, paddingLeft: space.xs }}>
            <Text variant="h3" numberOfLines={1}>
              Add items
            </Text>
            <Text variant="footnote" numberOfLines={1}>
              {cartCount > 0 ? `${cartCount} in cart · tap Done when finished` : 'Tap a product to add'}
            </Text>
          </View>
        </GlassSurface>
      </View>

      {/* Floating glass search bar — chrome (glass) wraps a raw TextInput.
          We don't use TextField here because its rigid bordered input box
          would fight the glass container for visual weight. */}
      <View style={styles.searchPad}>
        <GlassSurface radius={radius.full} contentStyle={styles.searchInner}>
          <Ionicons name="search" size={18} color={color.textTertiary} />
          <TextInput
            placeholder="Search menu"
            placeholderTextColor={color.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={hitSlop}>
              <Ionicons name="close-circle" size={18} color={color.textTertiary} />
            </Pressable>
          ) : null}
        </GlassSurface>
      </View>

      <View style={styles.catRailWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRail}
        >
          <CategoryPill
            label="All"
            active={category === ALL_CATEGORY}
            onPress={() => setCategory(ALL_CATEGORY)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c}
              label={c}
              active={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
          <CustomItemPill onPress={() => goCustom()} />
        </ScrollView>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.grid}
        numColumns={2}
        columnWrapperStyle={{ gap: space.sm }}
        ListEmptyComponent={
          <View style={{ paddingTop: space.xxl, gap: space.lg }}>
            <EmptyState
              icon="search-outline"
              title={search.trim() ? `No match for “${search.trim()}”` : 'No matches'}
              subtitle={
                search.trim()
                  ? 'Add it as a one-off, or save it to your menu for next time.'
                  : 'Try a different search term or category.'
              }
            />
            {search.trim() ? (
              <View style={styles.emptyCtaStack}>
                <Button
                  label={`Add “${search.trim()}” as a one-off`}
                  onPress={() => goCustom({ name: search.trim() })}
                  leadingIcon={
                    <Ionicons
                      name="sparkles-outline"
                      size={18}
                      color={color.primaryOn}
                    />
                  }
                />
                <Button
                  label="Save to menu"
                  variant="secondary"
                  onPress={() => goNewProduct(search.trim())}
                  leadingIcon={
                    <Ionicons
                      name="add-circle-outline"
                      size={18}
                      color={color.textPrimary}
                    />
                  }
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const vs = variantsFor(item);
          const inCart = cart.filter(
            (it) => it.product_id === item.id,
          ).reduce((acc, it) => acc + it.quantity, 0);
          return (
            <ProductTile
              product={item}
              variantCount={vs.length}
              inCart={inCart}
              onQuickAdd={() => handleProductTap(item)}
              onCustomize={() => {
                if (vs.length === 0) {
                  setCustomizeFor({ product: item, variant: null });
                } else {
                  setVariantSheet(item);
                }
              }}
            />
          );
        }}
      />

      <VariantSheet
        product={variantSheet}
        variants={variantSheet ? variantsFor(variantSheet) : []}
        reduceMotion={reduceMotion}
        onClose={() => setVariantSheet(null)}
        onConfirm={async (selections) => {
          const p = variantSheet!;
          setVariantSheet(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          // Fire all adds; useAddItem's optimistic cache merges them into the cart.
          for (const sel of selections) {
            await quickAddQty(p, sel.variant, sel.quantity);
          }
        }}
        onCustomize={(v) => {
          const p = variantSheet!;
          setVariantSheet(null);
          setCustomizeFor({ product: p, variant: v });
        }}
      />

      <CustomizeSheet
        state={customizeFor}
        modifiers={modifiers.data ?? []}
        reduceMotion={reduceMotion}
        onClose={() => setCustomizeFor(null)}
        onConfirm={async ({ quantity, toggledMods, note }) => {
          if (!customizeFor || !komandaId) return;
          const chosenMods: ModifierRowT[] =
            (modifiers.data ?? []).filter((m) => toggledMods.has(m.id));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          await addItem.mutateAsync({
            komanda_id: komandaId,
            product_id: customizeFor.product.id,
            variant_id: customizeFor.variant?.id ?? null,
            quantity,
            unit_price_cents: customizeFor.product.price_cents,
            product_name_snapshot: customizeFor.product.name,
            variant_name_snapshot: customizeFor.variant?.name ?? null,
            note_text: note.trim() || null,
            modifiers: chosenMods.map((m) => ({ modifier_id: m.id, name_snapshot: m.name })),
          });
          setCustomizeFor(null);
        }}
      />
    </Screen>
  );
}

// -----------------------------------------------------------------------------
// Category pill
// -----------------------------------------------------------------------------

function CategoryPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.catPill,
        active && styles.catPillActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: active ? fontWeight.semibold : fontWeight.medium,
          color: active ? color.primaryOn : color.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Custom-item pill — lives at the end of the category rail, opens the ad-hoc
// item flow. Always visible so servers can drop a one-off without scrolling
// to an empty-search state.
// -----------------------------------------------------------------------------

function CustomItemPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Add a custom one-off item"
      accessibilityHint="Opens a form to add an item that isn't on the menu."
      style={({ pressed }) => [
        styles.customPill,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name="add" size={16} color={palette.saffron600} />
      <Text
        style={{
          fontSize: 14,
          fontWeight: fontWeight.semibold,
          color: palette.saffron600,
        }}
      >
        Custom item
      </Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Product tile — primary action (tap anywhere) + small "customize" handle
// -----------------------------------------------------------------------------

function ProductTile({
  product,
  variantCount,
  inCart,
  onQuickAdd,
  onCustomize,
}: {
  product: ProductRowT;
  variantCount: number;
  inCart: number;
  onQuickAdd: () => void;
  onCustomize: () => void;
}) {
  // Deterministic "photo" tint from the product id so tiles feel distinct
  // without real imagery.
  const tint = pickTint(product.id);
  return (
    <View style={styles.tile}>
      <Pressable
        onLongPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onCustomize();
        }}
        onPress={onQuickAdd}
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name}, ${formatMXN(product.price_cents)}${
          inCart > 0 ? `, ${inCart} already in cart` : ''
        }`}
        accessibilityHint="Double tap to add one. Double tap and hold to customize."
        accessibilityActions={[
          { name: 'activate', label: 'Add one' },
          { name: 'longpress', label: 'Customize' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onCustomize();
          else onQuickAdd();
        }}
        style={({ pressed }) => [
          styles.tilePress,
          pressed && { opacity: 0.97, transform: [{ scale: 0.985 }] },
        ]}
      >
        {/* Photo-like hero area */}
        <View style={[styles.tileHero, { backgroundColor: tint.bg }]}>
          <Ionicons name="fast-food" size={36} color={tint.fg} />

          {inCart > 0 ? (
            <View style={styles.tileInCart}>
              <Text
                style={{
                  color: palette.ink900,
                  fontWeight: fontWeight.heavy,
                  fontSize: 12,
                  fontVariant: ['tabular-nums'],
                }}
              >
                ×{inCart}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Meta block */}
        <View style={styles.tileMeta}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {product.name}
          </Text>
          <View style={styles.tileMetaBottom}>
            <Text
              mono
              style={{
                fontSize: 15,
                fontWeight: fontWeight.bold,
                color: palette.terracotta600,
              }}
            >
              {formatMXN(product.price_cents)}
            </Text>
            {variantCount > 0 ? (
              <Text variant="caption">
                {variantCount} var
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Prominent "+" add CTA overlay (reference pattern) */}
      <Pressable
        onPress={onQuickAdd}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={`Quick add ${product.name}`}
        style={({ pressed }) => [
          styles.tileAdd,
          pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
        ]}
      >
        <Ionicons name="add" size={22} color={palette.ink900} />
      </Pressable>
    </View>
  );
}

const TINTS = [
  { bg: palette.saffron100, fg: palette.saffron600 },
  { bg: palette.terracotta100, fg: palette.terracotta600 },
  { bg: palette.success50, fg: palette.success500 },
  { bg: palette.info50, fg: palette.info500 },
  { bg: palette.sand, fg: palette.ink700 },
];

function pickTint(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

// -----------------------------------------------------------------------------
// Variant picker sheet
// -----------------------------------------------------------------------------

function VariantSheet({
  product,
  variants,
  reduceMotion,
  onClose,
  onConfirm,
  onCustomize,
}: {
  product: ProductRowT | null;
  variants: VariantRowT[];
  reduceMotion: boolean;
  onClose: () => void;
  onConfirm: (selections: { variant: VariantRowT; quantity: number }[]) => void;
  onCustomize: (v: VariantRowT) => void;
}) {
  const visible = !!product;
  const [qtys, setQtys] = useState<Record<string, number>>({});

  // Reset when the sheet is reopened for a different product
  useResetOnKey(product?.id ?? '', () => setQtys({}));

  const totalCount = Object.values(qtys).reduce((a, b) => a + b, 0);
  const totalCents = (product?.price_cents ?? 0) * totalCount;

  function bump(id: string, delta: number) {
    Haptics.selectionAsync().catch(() => {});
    setQtys((prev) => {
      const next = { ...prev };
      const v = Math.max(0, Math.min(99, (prev[id] ?? 0) + delta));
      if (v === 0) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.sheet} pointerEvents="box-none" accessibilityViewIsModal>
        <View style={styles.sheetInner}>
          <View style={styles.sheetHandle} />

          <View style={styles.variantHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="h3" numberOfLines={1}>
                {product?.name}
              </Text>
              <Text variant="footnote">Pick variants and quantities</Text>
            </View>
            <Text
              mono
              style={{
                fontSize: 15,
                fontWeight: fontWeight.bold,
                color: palette.terracotta600,
              }}
            >
              {formatMXN(product?.price_cents ?? 0)}
            </Text>
          </View>

          <ScrollView
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ gap: space.sm, paddingBottom: space.xs }}
            keyboardShouldPersistTaps="handled"
          >
            {variants.map((v) => {
              const q = qtys[v.id] ?? 0;
              const active = q > 0;
              return (
                <View
                  key={v.id}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={`${v.name}, ${formatMXN(product?.price_cents ?? 0)}`}
                  accessibilityValue={{ min: 0, max: 99, now: q, text: `${q}` }}
                  accessibilityState={{ selected: active }}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'increment') bump(v.id, +1);
                    else if (e.nativeEvent.actionName === 'decrement') bump(v.id, -1);
                  }}
                  style={[
                    styles.variantPickerRow,
                    active && styles.variantPickerRowActive,
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {v.name}
                    </Text>
                    {active ? (
                      <Text
                        mono
                        style={{
                          fontSize: 12,
                          color: palette.terracotta600,
                          fontWeight: fontWeight.semibold,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {q} × {formatMXN(product?.price_cents ?? 0)}  ={' '}
                        {formatMXN((product?.price_cents ?? 0) * q)}
                      </Text>
                    ) : (
                      <Text variant="caption">Tap + to add</Text>
                    )}
                  </View>

                  <Pressable
                    onPress={() => onCustomize(v)}
                    hitSlop={hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Customize ${v.name}`}
                    style={({ pressed }) => [
                      styles.variantOptionsBtn,
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Ionicons
                      name="options-outline"
                      size={16}
                      color={color.textSecondary}
                    />
                  </Pressable>

                  <CompactStepper
                    value={q}
                    onDecrement={() => bump(v.id, -1)}
                    onIncrement={() => bump(v.id, +1)}
                  />
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.variantFooter}>
            <Button
              label="Cancel"
              variant="ghost"
              haptic={false}
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              label={
                totalCount > 0
                  ? `Add ${totalCount} · ${formatMXN(totalCents)}`
                  : 'Pick at least one'
              }
              disabled={totalCount === 0}
              onPress={() => {
                const selections = variants
                  .filter((v) => (qtys[v.id] ?? 0) > 0)
                  .map((v) => ({ variant: v, quantity: qtys[v.id] ?? 0 }));
                onConfirm(selections);
              }}
              leadingIcon={
                totalCount > 0 ? (
                  <Ionicons name="checkmark" size={18} color={color.primaryOn} />
                ) : undefined
              }
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CompactStepper({
  value,
  onDecrement,
  onIncrement,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const disableMinus = value <= 0;
  // Parent row is accessibilityRole="adjustable" so we hide the individual
  // − / + buttons from VoiceOver — otherwise VO reads the row + each button.
  // Voice Control can still target them by the numeric overlay.
  return (
    <View style={styles.compactStepper} importantForAccessibility="no-hide-descendants">
      <Pressable
        onPress={onDecrement}
        disabled={disableMinus}
        accessibilityElementsHidden
        importantForAccessibility="no"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => [
          styles.compactStepBtn,
          styles.compactStepBtnMinus,
          disableMinus && { opacity: 0.35 },
          pressed && !disableMinus && { opacity: 0.7 },
        ]}
      >
        <Ionicons name="remove" size={16} color={color.textPrimary} />
      </Pressable>
      <Text
        style={{
          fontSize: 15,
          fontWeight: fontWeight.bold,
          color: value > 0 ? color.textPrimary : color.textTertiary,
          fontVariant: ['tabular-nums'],
          minWidth: 20,
          textAlign: 'center',
        }}
      >
        {value}
      </Text>
      <Pressable
        onPress={onIncrement}
        accessibilityElementsHidden
        importantForAccessibility="no"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => [
          styles.compactStepBtn,
          styles.compactStepBtnPlus,
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Ionicons name="add" size={16} color={palette.ink900} />
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Customize sheet (quantity + modifiers + note)
// -----------------------------------------------------------------------------

function CustomizeSheet({
  state,
  modifiers,
  reduceMotion,
  onClose,
  onConfirm,
}: {
  state: { product: ProductRowT; variant: VariantRowT | null } | null;
  modifiers: ModifierRowT[];
  reduceMotion: boolean;
  onClose: () => void;
  onConfirm: (result: {
    quantity: number;
    toggledMods: Set<string>;
    note: string;
  }) => void | Promise<void>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [toggledMods, setToggledMods] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  // Reset when the sheet is reopened for a different item
  const visible = !!state;
  const key = state ? `${state.product.id}-${state.variant?.id ?? 'base'}` : '';
  useResetOnKey(key, () => {
    setQuantity(1);
    setToggledMods(new Set());
    setNote('');
  });

  const lineTotal = (state?.product.price_cents ?? 0) * quantity;

  return (
    <Modal
      visible={visible}
      transparent
      // HIG: replace slides with fades when Reduce Motion is on.
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.sheet} pointerEvents="box-none" accessibilityViewIsModal>
        <View style={styles.sheetInner}>
          <View style={styles.sheetHandle} />
          <View style={styles.customizeHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="h3" numberOfLines={1}>
                {state?.product.name}
              </Text>
              {state?.variant ? (
                <Text variant="footnote" numberOfLines={1}>
                  {state.variant.name}
                </Text>
              ) : null}
            </View>
            <Text
              mono
              style={{
                fontSize: 16,
                fontWeight: fontWeight.bold,
                color: color.primary,
              }}
            >
              {formatMXN(state?.product.price_cents ?? 0)}
            </Text>
          </View>

          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.customizeSection}>
              <Text variant="label">Quantity</Text>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </View>

            {modifiers.length > 0 ? (
              <View style={styles.customizeSection}>
                <Text variant="label">Modifiers</Text>
                <View style={styles.modRow}>
                  {modifiers.map((m) => {
                    const on = toggledMods.has(m.id);
                    return (
                      <Chip
                        key={m.id}
                        label={m.name}
                        selected={on}
                        onPress={() => {
                          const next = new Set(toggledMods);
                          if (on) next.delete(m.id);
                          else next.add(m.id);
                          setToggledMods(next);
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            <TextField
              label="Note"
              placeholder="e.g. extra salsa, no onion"
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
            />
          </ScrollView>

          <View style={styles.customizeFooter}>
            <Button
              label={`Add ${quantity} · ${formatMXN(lineTotal)}`}
              onPress={() =>
                onConfirm({ quantity, toggledMods, note })
              }
              leadingIcon={<Ionicons name="checkmark" size={20} color={color.primaryOn} />}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Runs `fn` once whenever `key` changes. */
function useResetOnKey(key: string, fn: () => void) {
  const [prev, setPrev] = useState(key);
  if (prev !== key) {
    fn();
    setPrev(key);
  }
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const TILE_RADIUS = radius.lg;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Glass chrome — nav and search both sit on the warm canvas, inset from edges.
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

  searchPad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: color.textPrimary,
    fontWeight: '500',
    paddingVertical: 0,
  },

  catRailWrap: {
    paddingBottom: space.sm,
  },
  catRail: {
    paddingHorizontal: space.lg,
    gap: space.xs,
  },
  catPill: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPillActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  customPill: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.saffron500,
    backgroundColor: palette.saffron50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyCtaStack: {
    paddingHorizontal: space.xl,
    gap: space.sm,
  },

  grid: {
    paddingHorizontal: space.lg,
    paddingBottom: 120,
    gap: space.sm,
  },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: space.lg,
  },

  tile: {
    flex: 1,
    marginBottom: space.sm,
    position: 'relative',
  },
  tilePress: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: 'hidden',
    minHeight: 180,
    ...shadow.sm,
  },
  tileHero: {
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tileInCart: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    minWidth: 30,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: palette.saffron500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMeta: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: 4,
    flex: 1,
    justifyContent: 'space-between',
  },
  tileMetaBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  tileAdd: {
    position: 'absolute',
    right: space.sm,
    top: 108 - 22, // Straddles the hero/meta boundary
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: palette.saffron500,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
    borderWidth: 2,
    borderColor: color.surface,
  },

  // Sticky done bar (acts like a CTA that also summarises the cart)
  // The outer GlassSurface (variant="dark") owns the backdrop, shadow, and
  // specular highlight — this inner row just lays out content.
  doneBar: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  doneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
  },
  doneRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  doneCountBubble: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: palette.saffron500,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sheet
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.scrim,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetInner: {
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    ...shadow.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: color.borderStrong,
    marginBottom: space.md,
  },

  // Variant picker (multi-select with per-row quantity)
  variantHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingBottom: space.md,
  },
  variantPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    minHeight: 60,
  },
  variantPickerRowActive: {
    borderColor: palette.saffron500,
    backgroundColor: palette.saffron50,
  },
  variantOptionsBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantFooter: {
    flexDirection: 'row',
    gap: space.sm,
    paddingTop: space.md,
  },

  // Compact inline stepper used inside variant rows
  compactStepper: {
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
  compactStepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactStepBtnMinus: {
    backgroundColor: color.surfaceAlt,
  },
  compactStepBtnPlus: {
    backgroundColor: palette.saffron500,
  },

  // Customize sheet
  customizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space.md,
    gap: space.md,
  },
  customizeSection: { gap: space.sm },
  modRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  customizeFooter: {
    paddingTop: space.md,
  },
});
