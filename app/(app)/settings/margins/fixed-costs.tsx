import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import {
  fetchAllRecipeLines,
  fetchFixedCosts,
  fetchIngredients,
  fetchMarginAssumptions,
} from '@/insforge/queries/margins';
import { fetchAllProducts } from '@/insforge/queries/menu';
import {
  useDeleteFixedCost,
  useUpsertFixedCost,
} from '@/mutations/useUpsertFixedCost';
import { formatMXN } from '@/domain/money';
import {
  dailyBreakEvenUnits,
  effectiveUberPriceCents,
  ingredientCostCents,
  marginPerUnit,
  type Ingredient,
  type MarginAssumptions,
  type RecipeLine,
} from '@/domain/margins';
import { BreakEvenCard } from '@/features/margins/components/BreakEvenCard';

const FALLBACK: MarginAssumptions = {
  uberCommissionPct: 0.3464,
  uberIvaRetentionPct: 0.0951,
  markupA: 1.53,
  markupB: 1.79,
};

export default function FixedCostsScreen() {
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const orgId = me?.org_id ?? '';

  const fixedCostsQ = useQuery({
    queryKey: ['fixed-costs', orgId],
    queryFn: () => fetchFixedCosts(orgId),
    enabled: !!orgId,
  });
  const assumptionsQ = useQuery({
    queryKey: ['margin-assumptions', orgId],
    queryFn: () => fetchMarginAssumptions(orgId),
    enabled: !!orgId,
  });
  const productsQ = useQuery({
    queryKey: ['products', 'all'],
    queryFn: fetchAllProducts,
    enabled: !!orgId,
  });
  const ingredientsQ = useQuery({
    queryKey: ['ingredients', orgId],
    queryFn: () => fetchIngredients(orgId),
    enabled: !!orgId,
  });
  const recipeLinesQ = useQuery({
    queryKey: ['recipe-lines', 'all', orgId],
    queryFn: () => fetchAllRecipeLines(orgId),
    enabled: !!orgId,
  });

  const upsert = useUpsertFixedCost(orgId);
  const del = useDeleteFixedCost(orgId);

  const [label, setLabel] = useState('');
  const [dailyText, setDailyText] = useState('');
  const [notes, setNotes] = useState('');

  if (me && me.role !== 'admin') {
    return (
      <Screen>
        <ScreenHeader showBack title="Fixed daily costs" />
        <View style={styles.deniedWrap}>
          <Ionicons name="lock-closed-outline" size={32} color={color.textTertiary} />
          <Text variant="bodyStrong" align="center">Permission denied</Text>
        </View>
      </Screen>
    );
  }

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

  const fixedDailyCents = useMemo(
    () =>
      (fixedCostsQ.data ?? [])
        .filter((f) => f.active)
        .reduce((sum, f) => sum + f.daily_cents, 0),
    [fixedCostsQ.data]
  );

  const ingredientsForCalc: Ingredient[] = useMemo(
    () =>
      (ingredientsQ.data ?? []).map((i) => ({
        id: i.id,
        unit: i.unit,
        costCentsPerUnit: i.cost_cents_per_unit,
      })),
    [ingredientsQ.data]
  );

  const scenarios = useMemo(() => {
    const recipeByProduct = new Map<string, RecipeLine[]>();
    for (const line of recipeLinesQ.data ?? []) {
      const arr = recipeByProduct.get(line.product_id) ?? [];
      arr.push({ ingredientId: line.ingredient_id, quantity: line.quantity });
      recipeByProduct.set(line.product_id, arr);
    }
    const out: Array<{ label: string; units: number }> = [];
    for (const p of productsQ.data ?? []) {
      const recipe = recipeByProduct.get(p.id);
      if (!recipe || recipe.length === 0) continue;
      let cost = 0;
      try {
        cost = ingredientCostCents(recipe, ingredientsForCalc);
      } catch {
        continue;
      }
      const uberPrice = effectiveUberPriceCents(
        p.price_cents,
        p.uber_price_cents ?? null,
        'A',
        assumptions
      );
      const m = marginPerUnit({
        priceCents: p.price_cents,
        uberPriceCents: uberPrice,
        ingredientCostCents: cost,
        assumptions,
        withIvaRetention: false,
      });
      out.push({
        label: p.name,
        units: dailyBreakEvenUnits(fixedDailyCents, m.inStoreCents),
      });
    }
    return out
      .filter((s) => Number.isFinite(s.units))
      .sort((a, b) => a.units - b.units)
      .slice(0, 5);
  }, [
    productsQ.data,
    recipeLinesQ.data,
    ingredientsForCalc,
    assumptions,
    fixedDailyCents,
  ]);

  function handleAdd() {
    const trimmed = label.trim();
    const daily = Number(dailyText.replace(',', '.'));
    if (!trimmed || !Number.isFinite(daily) || daily < 0) {
      Alert.alert('Invalid', 'Label and a non-negative daily amount required.');
      return;
    }
    upsert.mutate(
      {
        label: trimmed,
        // dailyText is whole pesos for owner convenience — convert to cents.
        dailyCents: Math.round(daily * 100),
        notes: notes.trim() || null,
        active: true,
      },
      {
        onSuccess: () => {
          setLabel('');
          setDailyText('');
          setNotes('');
        },
        onError: (e) =>
          Alert.alert('Could not add', String((e as Error).message)),
      }
    );
  }

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Fixed daily costs" />
      </View>

      <View style={{ paddingHorizontal: space.lg }}>
        <BreakEvenCard fixedDailyCostCents={fixedDailyCents} scenarios={scenarios} />
      </View>

      <Card style={styles.addCard}>
        <Text variant="label">Add fixed cost</Text>
        <TextField
          label="Label"
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Rent (daily), Gas, Salsa & onion"
        />
        <TextField
          label="MX$ per day"
          hint="Whole pesos. For monthly bills, divide by 30."
          keyboardType="decimal-pad"
          value={dailyText}
          onChangeText={setDailyText}
        />
        <TextField
          label="Notes (optional)"
          hint="Use this for restock-cash-bucket notes."
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <Button
          label="Add"
          onPress={handleAdd}
          loading={upsert.isPending}
          disabled={upsert.isPending}
        />
      </Card>

      {fixedCostsQ.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList
          data={fixedCostsQ.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="cash-outline"
              title="No fixed costs yet"
              subtitle="Add labor, rent, gas, condiments, packaging…"
            />
          }
          renderItem={({ item }) => (
            <Card padded={false} style={styles.row}>
              <View style={styles.rowInner}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" style={!item.active && styles.dim}>
                    {item.label}
                  </Text>
                  <Text variant="footnote">
                    {formatMXN(item.daily_cents)}/day{!item.active ? ' · inactive' : ''}
                  </Text>
                  {item.notes ? (
                    <Text variant="footnote">{item.notes}</Text>
                  ) : null}
                </View>
                <Button
                  label="Delete"
                  variant="destructive"
                  onPress={() => {
                    Alert.alert(
                      'Delete fixed cost?',
                      `"${item.label}" will be removed.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () =>
                            del.mutate(item.id, {
                              onError: (e) =>
                                Alert.alert(
                                  'Could not delete',
                                  String((e as Error).message)
                                ),
                            }),
                        },
                      ]
                    );
                  }}
                />
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addCard: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    marginTop: space.md,
    gap: space.sm,
  },
  loading: { padding: space.xxl, alignItems: 'center' },
  list: { paddingBottom: space.xxl, gap: space.sm, paddingHorizontal: space.lg },
  row: {},
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  dim: { opacity: 0.5 },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xxl,
  },
});
