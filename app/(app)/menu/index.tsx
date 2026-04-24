import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchAllProducts, fetchAllVariants } from '@/insforge/queries/menu';
import { formatMXN } from '@/domain/money';
import type { ProductRowT, VariantRowT } from '@/insforge/schemas';
import {
  Card,
  EmptyState,
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

type Section = { category: string; products: ProductRowT[] };

export default function MenuIndex() {
  const router = useRouter();
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: fetchAllProducts,
  });
  const variants = useQuery({
    queryKey: ['variants', 'all'],
    queryFn: fetchAllVariants,
  });

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allProducts = products.data ?? [];
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    );
  }, [allProducts, search]);

  const sections: Section[] = useMemo(
    () => groupByCategory(filteredProducts),
    [filteredProducts],
  );
  const variantCount = useMemo(
    () => countByProduct(variants.data ?? []),
    [variants.data],
  );

  function toggleCategory(category: string) {
    Haptics.selectionAsync().catch(() => {});
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function goNew() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/(app)/menu/product/new');
  }

  const rows = useMemo(
    () => flatten(sections, collapsed),
    [sections, collapsed],
  );

  const totalProducts = allProducts.length;
  const visibleCount = filteredProducts.length;
  const hiddenCount = allProducts.filter((p) => !p.active).length;
  const subtitle = totalProducts
    ? search.trim()
      ? `${visibleCount} of ${totalProducts} products`
      : `${totalProducts} products${
          hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''
        }`
    : null;

  // Liquid Glass: warm canvas paints behind everything. Top nav pill +
  // floating FAB are glass chrome. Search field and list cards are CONTENT
  // and stay solid/light.
  return (
    <Screen padded={false} edges={['top']} floatingFooter>
      {/* Floating glass nav pill — back chevron + eyebrow/title + modifiers
          IconButton. NB: direct router.push — wrapping custom Button/IconButton
          in <Link asChild> breaks haptic onPress routing. */}
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
              Menu
            </Text>
            <Text variant="h3" numberOfLines={1}>
              Products
            </Text>
          </View>
          <IconButton
            glass
            name="options-outline"
            accessibilityLabel="Modifiers"
            onPress={() => router.push('/(app)/menu/modifiers')}
          />
        </GlassSurface>
      </View>

      {/* Metadata strip under the nav — count + hidden count. */}
      {subtitle ? (
        <View style={styles.metaPad}>
          <Text variant="footnote" style={{ color: color.textSecondary }}>
            {subtitle}
          </Text>
        </View>
      ) : null}

      {/* Search field — CONTENT, not chrome. Stays flat and solid. */}
      {totalProducts > 0 ? (
        <View style={styles.searchPad}>
          <TextField
            placeholder="Search name or category"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            leading={
              <Ionicons
                name="search"
                size={18}
                color={color.textTertiary}
              />
            }
            trailing={
              search ? (
                <Pressable
                  onPress={() => setSearch('')}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={color.textTertiary}
                  />
                </Pressable>
              ) : null
            }
          />
        </View>
      ) : null}

      {products.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) =>
            r.kind === 'header' ? `h:${r.category}` : r.product.id
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            search.trim() ? (
              <EmptyState
                icon="search-outline"
                title="No matches"
                subtitle={`Nothing matches “${search.trim()}”. Try a different term.`}
              />
            ) : (
              <EmptyState
                icon="restaurant-outline"
                title="No products yet"
                subtitle="Add your first product to start building your menu."
              />
            )
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <SectionHeader
                  category={item.category}
                  count={item.count}
                  collapsed={item.collapsed}
                  onToggle={() => toggleCategory(item.category)}
                />
              );
            }
            return (
              <ProductRow
                product={item.product}
                variantCount={variantCount[item.product.id] ?? 0}
                onPress={() =>
                  router.push(`/(app)/menu/product/${item.product.id}`)
                }
              />
            );
          }}
        />
      )}

      {/* Glass-tinted floating "New" FAB — concentric capsule, specular
          highlight, warm terracotta wash. Mirrors komandas list. */}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <GlassSurface variant="primary" radius={radius.full}>
          <Pressable
            onPress={goNew}
            accessibilityRole="button"
            accessibilityLabel="New product"
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            style={({ pressed }) => [
              styles.fabInner,
              pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Ionicons name="add" size={22} color={color.primaryOn} />
            <Text
              style={{
                color: color.primaryOn,
                fontWeight: fontWeight.semibold,
                fontSize: 16,
              }}
            >
              New product
            </Text>
          </Pressable>
        </GlassSurface>
      </View>
    </Screen>
  );
}

function SectionHeader({
  category,
  count,
  collapsed,
  onToggle,
}: {
  category: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${category} section, ${count} products`}
      accessibilityState={{ expanded: !collapsed }}
      accessibilityHint={
        collapsed ? 'Double tap to expand' : 'Double tap to collapse'
      }
      style={({ pressed }) => [
        styles.sectionHeader,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons
        name={collapsed ? 'chevron-forward' : 'chevron-down'}
        size={14}
        color={color.textTertiary}
      />
      <Text
        variant="label"
        style={{ color: color.textSecondary, letterSpacing: 0.8, flex: 1 }}
      >
        {category}
      </Text>
      <View style={styles.sectionCount}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: fontWeight.bold,
            color: color.textSecondary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function ProductRow({
  product,
  variantCount,
  onPress,
}: {
  product: ProductRowT;
  variantCount: number;
  onPress: () => void;
}) {
  const tint = pickRowTint(product.id);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${product.name}, ${formatMXN(
        product.price_cents,
      )}${!product.active ? ', hidden' : ''}`}
      style={({ pressed }) => [
        styles.rowPress,
        pressed && { opacity: 0.95, transform: [{ scale: 0.995 }] },
      ]}
    >
      <Card padded={false} style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: tint.bg }]}>
          <Ionicons name="fast-food" size={22} color={tint.fg} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTitle}>
            <Text
              variant="bodyStrong"
              numberOfLines={1}
              style={[
                { flex: 1 },
                !product.active && { color: color.textSecondary },
              ]}
            >
              {product.name}
            </Text>
            {!product.active ? (
              <View style={styles.inactiveBadge}>
                <Text variant="caption" style={{ color: color.warningText }}>
                  Hidden
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.rowMeta}>
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
              <>
                <View style={styles.rowMetaDot} />
                <Text variant="footnote">
                  {variantCount} variant{variantCount === 1 ? '' : 's'}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={color.textTertiary}
        />
      </Card>
    </Pressable>
  );
}

const ROW_TINTS = [
  { bg: palette.saffron100, fg: palette.saffron600 },
  { bg: palette.terracotta100, fg: palette.terracotta600 },
  { bg: palette.success50, fg: palette.success500 },
  { bg: palette.info50, fg: palette.info500 },
  { bg: palette.sand, fg: palette.ink700 },
];
function pickRowTint(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ROW_TINTS[Math.abs(h) % ROW_TINTS.length];
}

function groupByCategory(products: ProductRowT[]): Section[] {
  const bins = new Map<string, ProductRowT[]>();
  for (const p of products) {
    const key = (p.category || 'Other').trim() || 'Other';
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key)!.push(p);
  }
  return [...bins.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, products]) => ({ category, products }));
}

function countByProduct(variants: VariantRowT[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of variants) {
    if (!v.active) continue;
    out[v.product_id] = (out[v.product_id] ?? 0) + 1;
  }
  return out;
}

type Row =
  | { kind: 'header'; category: string; count: number; collapsed: boolean }
  | { kind: 'item'; product: ProductRowT };

function flatten(sections: Section[], collapsed: Set<string>): Row[] {
  const out: Row[] = [];
  for (const s of sections) {
    const isCollapsed = collapsed.has(s.category);
    out.push({
      kind: 'header',
      category: s.category.toUpperCase(),
      count: s.products.length,
      collapsed: isCollapsed,
    });
    if (!isCollapsed) {
      for (const p of s.products) out.push({ kind: 'item', product: p });
    }
  }
  return out;
}

const styles = StyleSheet.create({
  // Floating glass nav — inset from the edges so WarmCanvas wraps the corners.
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

  metaPad: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xs,
  },

  // Search field — CONTENT, not chrome.
  searchPad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: 120,
    gap: space.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    marginBottom: space.xs,
    paddingVertical: space.xs,
    minHeight: 32,
  },
  sectionCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPress: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: color.textTertiary,
  },
  inactiveBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: color.warningBg,
  },

  // Floating glass-tinted FAB. GlassSurface owns the shadow + specular.
  fabWrap: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    minHeight: 52,
  },
});
