import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchProductById } from '@/insforge/queries/menu';
import {
  fetchIngredients,
  fetchMarginAssumptions,
  fetchRecipeLinesForProduct,
} from '@/insforge/queries/margins';
import {
  useDeleteRecipeLine,
  useUpsertRecipeLine,
} from '@/mutations/useUpsertRecipeLine';
import { useSetUberPrice } from '@/mutations/useSetUberPrice';
import {
  effectiveUberPriceCents,
  ingredientCostCents,
  marginPerUnit,
  type Ingredient,
  type MarginAssumptions,
} from '@/domain/margins';
import { MarginSummaryCard } from '@/features/margins/components/MarginSummaryCard';
import { RecipeLineEditor } from '@/features/margins/components/RecipeLineEditor';

const FALLBACK: MarginAssumptions = {
  uberCommissionPct: 0.3464,
  uberIvaRetentionPct: 0.0951,
  markupA: 1.53,
  markupB: 1.79,
};

export default function ProductMarginDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = id ?? '';

  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const orgId = me?.org_id ?? '';

  const productQ = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductById(productId),
    enabled: !!productId,
  });
  const recipeQ = useQuery({
    queryKey: ['recipe-lines', productId],
    queryFn: () => fetchRecipeLinesForProduct(productId),
    enabled: !!productId,
  });
  const ingredientsQ = useQuery({
    queryKey: ['ingredients', orgId],
    queryFn: () => fetchIngredients(orgId),
    enabled: !!orgId,
  });
  const assumptionsQ = useQuery({
    queryKey: ['margin-assumptions', orgId],
    queryFn: () => fetchMarginAssumptions(orgId),
    enabled: !!orgId,
  });

  const upsertLine = useUpsertRecipeLine(orgId);
  const deleteLine = useDeleteRecipeLine(orgId);
  const setUber = useSetUberPrice();

  const [uberOverrideText, setUberOverrideText] = useState('');

  const assumptions: MarginAssumptions = useMemo(() => {
    const a = assumptionsQ.data;
    if (!a) return FALLBACK;
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

  if (me && me.role !== 'admin') {
    return (
      <Screen>
        <ScreenHeader showBack title="Product margin" />
        <View style={styles.deniedWrap}>
          <Ionicons name="lock-closed-outline" size={32} color={color.textTertiary} />
          <Text variant="bodyStrong" align="center">Permission denied</Text>
        </View>
      </Screen>
    );
  }

  const loading =
    productQ.isLoading ||
    recipeQ.isLoading ||
    ingredientsQ.isLoading ||
    assumptionsQ.isLoading;

  const product = productQ.data;
  const recipe = recipeQ.data ?? [];

  let costCents = 0;
  try {
    costCents = ingredientCostCents(
      recipe.map((l) => ({
        ingredientId: l.ingredient_id,
        quantity: l.quantity,
      })),
      ingredientsForCalc
    );
  } catch {
    costCents = 0;
  }

  const uberPriceCents = product
    ? effectiveUberPriceCents(
        product.price_cents,
        product.uber_price_cents ?? null,
        'A',
        assumptions
      )
    : 0;

  const m = product
    ? marginPerUnit({
        priceCents: product.price_cents,
        uberPriceCents,
        ingredientCostCents: costCents,
        assumptions,
        withIvaRetention: false,
      })
    : { inStoreCents: 0, uberEatsCents: 0 };

  function handleSaveUberOverride() {
    if (!product) return;
    const raw = uberOverrideText.trim();
    if (!raw) {
      // Clear override
      setUber.mutate(
        { productId: product.id, uberPriceCents: null },
        {
          onSuccess: () => setUberOverrideText(''),
          onError: (e) =>
            Alert.alert('Could not save', String((e as Error).message)),
        }
      );
      return;
    }
    const pesos = Number(raw.replace(',', '.'));
    if (!Number.isFinite(pesos) || pesos < 0) {
      Alert.alert('Invalid', 'Enter a non-negative price in pesos.');
      return;
    }
    setUber.mutate(
      { productId: product.id, uberPriceCents: Math.round(pesos * 100) },
      {
        onSuccess: () => setUberOverrideText(''),
        onError: (e) =>
          Alert.alert('Could not save', String((e as Error).message)),
      }
    );
  }

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title={product?.name ?? 'Product margin'} />
      </View>

      {loading || !product ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <MarginSummaryCard
            title={product.name}
            inStorePriceCents={product.price_cents}
            uberPriceCents={uberPriceCents}
            ingredientCostCents={costCents}
            inStoreMarginCents={m.inStoreCents}
            uberMarginCents={m.uberEatsCents}
          />

          <Card style={styles.card}>
            <Text variant="h3">Uber Eats price</Text>
            <Text variant="footnote">
              Leave empty to derive from in-store × markup A. Enter pesos to
              override.
            </Text>
            <TextField
              label="Override (MX$)"
              keyboardType="decimal-pad"
              value={uberOverrideText}
              onChangeText={setUberOverrideText}
              placeholder={
                product.uber_price_cents != null
                  ? String(product.uber_price_cents / 100)
                  : 'derived'
              }
            />
            <Button
              label="Save"
              onPress={handleSaveUberOverride}
              loading={setUber.isPending}
              disabled={setUber.isPending}
            />
          </Card>

          <RecipeLineEditor
            lines={recipe}
            ingredients={ingredientsQ.data ?? []}
            onAdd={(draft) =>
              upsertLine.mutate(
                {
                  productId: product.id,
                  ingredientId: draft.ingredientId,
                  quantity: draft.quantity,
                },
                {
                  onError: (e) =>
                    Alert.alert('Could not add', String((e as Error).message)),
                }
              )
            }
            onDelete={(lineId) =>
              deleteLine.mutate(
                { id: lineId, productId: product.id },
                {
                  onError: (e) =>
                    Alert.alert(
                      'Could not delete',
                      String((e as Error).message)
                    ),
                }
              )
            }
            busy={upsertLine.isPending || deleteLine.isPending}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { padding: space.xxl, alignItems: 'center' },
  content: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
  },
  card: { gap: space.sm },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xxl,
  },
});
