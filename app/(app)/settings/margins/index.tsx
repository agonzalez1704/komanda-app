import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchAllProducts } from '@/insforge/queries/menu';
import {
  fetchAllRecipeLines,
  fetchFixedCosts,
  fetchIngredients,
  fetchMarginAssumptions,
} from '@/insforge/queries/margins';
import {
  effectiveUberPriceCents,
  ingredientCostCents,
  marginPerUnit,
  type MarginAssumptions,
  type RecipeLine,
  type Ingredient,
} from '@/domain/margins';
import { ProductMarginRow } from '@/features/margins/components/ProductMarginRow';

const FALLBACK_ASSUMPTIONS: MarginAssumptions = {
  uberCommissionPct: 0.3464,
  uberIvaRetentionPct: 0.0951,
  markupA: 1.53,
  markupB: 1.79,
};

export default function MarginsOverview() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';

  const isAdmin = me?.role === 'admin';

  const assumptionsQ = useQuery({
    queryKey: ['margin-assumptions', orgId],
    queryFn: () => fetchMarginAssumptions(orgId),
    enabled: !!orgId && isAdmin,
  });
  const productsQ = useQuery({
    queryKey: ['products', 'all'],
    queryFn: fetchAllProducts,
    enabled: !!orgId && isAdmin,
  });
  const ingredientsQ = useQuery({
    queryKey: ['ingredients', orgId],
    queryFn: () => fetchIngredients(orgId),
    enabled: !!orgId && isAdmin,
  });
  const recipeLinesQ = useQuery({
    queryKey: ['recipe-lines', 'all', orgId],
    queryFn: () => fetchAllRecipeLines(orgId),
    enabled: !!orgId && isAdmin,
  });
  const fixedCostsQ = useQuery({
    queryKey: ['fixed-costs', orgId],
    queryFn: () => fetchFixedCosts(orgId),
    enabled: !!orgId && isAdmin,
  });

  const assumptions: MarginAssumptions = useMemo(() => {
    const a = assumptionsQ.data;
    if (!a) return FALLBACK_ASSUMPTIONS;
    return {
      uberCommissionPct: a.uber_commission_pct,
      uberIvaRetentionPct: a.uber_iva_retention_pct,
      markupA: a.markup_a,
      markupB: a.markup_b,
    };
  }, [assumptionsQ.data]);

  const ingredientsForCalc: Ingredient[] = useMemo(
    () =>
      (ingredientsQ.data ?? []).map((i) => ({
        id: i.id,
        unit: i.unit,
        costCentsPerUnit: i.cost_cents_per_unit,
      })),
    [ingredientsQ.data]
  );

  const recipeByProduct = useMemo(() => {
    const map = new Map<string, RecipeLine[]>();
    for (const line of recipeLinesQ.data ?? []) {
      const arr = map.get(line.product_id) ?? [];
      arr.push({ ingredientId: line.ingredient_id, quantity: line.quantity });
      map.set(line.product_id, arr);
    }
    return map;
  }, [recipeLinesQ.data]);

  const fixedDailyCents = useMemo(
    () =>
      (fixedCostsQ.data ?? [])
        .filter((f) => f.active)
        .reduce((sum, f) => sum + f.daily_cents, 0),
    [fixedCostsQ.data]
  );

  // Redirect non-admin: they should never have reached this route via the
  // gated nav row, but defend the deep-link path too.
  if (!meLoading && me && !isAdmin) {
    return (
      <Screen>
        <ScreenHeader showBack title="Margins & Costs" />
        <View style={styles.deniedWrap}>
          <Ionicons name="lock-closed-outline" size={32} color={color.textTertiary} />
          <Text variant="bodyStrong" align="center">Permission denied</Text>
          <Text variant="bodySm" align="center">Only admins can view margins.</Text>
        </View>
      </Screen>
    );
  }

  const loading =
    meLoading ||
    assumptionsQ.isLoading ||
    productsQ.isLoading ||
    ingredientsQ.isLoading ||
    recipeLinesQ.isLoading ||
    fixedCostsQ.isLoading;

  const products = productsQ.data ?? [];

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Margins & Costs" />
      </View>

      <View style={styles.navRow}>
        <Link href={'/(app)/settings/margins/ingredients' as any} asChild>
          <View style={styles.navCard}>
            <Ionicons name="leaf-outline" size={20} color={color.textSecondary} />
            <Text variant="bodyStrong">Ingredients</Text>
          </View>
        </Link>
        <Link href={'/(app)/settings/margins/fixed-costs' as any} asChild>
          <View style={styles.navCard}>
            <Ionicons name="cash-outline" size={20} color={color.textSecondary} />
            <Text variant="bodyStrong">Fixed costs</Text>
          </View>
        </Link>
        <Link href={'/(app)/settings/margins/assumptions' as any} asChild>
          <View style={styles.navCard}>
            <Ionicons name="options-outline" size={20} color={color.textSecondary} />
            <Text variant="bodyStrong">Assumptions</Text>
          </View>
        </Link>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
              <Text variant="caption">
                Fixed daily cost: {(fixedDailyCents / 100).toFixed(2)} MXN
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="restaurant-outline"
              title="No products yet"
              subtitle="Add products from the Menu screen first."
            />
          }
          renderItem={({ item }) => {
            const recipe = recipeByProduct.get(item.id) ?? [];
            const missingRecipe = recipe.length === 0;
            let costCents = 0;
            try {
              costCents = ingredientCostCents(recipe, ingredientsForCalc);
            } catch {
              costCents = 0;
            }
            const uberPriceCents = effectiveUberPriceCents(
              item.price_cents,
              item.uber_price_cents ?? null,
              'A',
              assumptions
            );
            const m = marginPerUnit({
              priceCents: item.price_cents,
              uberPriceCents,
              ingredientCostCents: costCents,
              assumptions,
              withIvaRetention: false,
            });
            return (
              <Card padded={false} style={styles.productCard}>
                <ProductMarginRow
                  name={item.name}
                  category={item.category}
                  inStorePriceCents={item.price_cents}
                  uberPriceCents={uberPriceCents}
                  marginCents={m.inStoreCents}
                  missingRecipe={missingRecipe}
                  onPress={() =>
                    router.push(
                      `/(app)/settings/margins/product/${item.id}` as any
                    )
                  }
                />
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { padding: space.xxl, alignItems: 'center' },
  list: { paddingBottom: space.xxl, gap: space.sm },
  productCard: { marginHorizontal: space.lg },
  navRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  navCard: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: 12,
    padding: space.md,
    alignItems: 'center',
    gap: space.xs,
  },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xxl,
  },
});
