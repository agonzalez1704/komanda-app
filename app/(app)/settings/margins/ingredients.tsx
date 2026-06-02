import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchIngredients } from '@/insforge/queries/margins';
import { useUpsertIngredient } from '@/mutations/useUpsertIngredient';
import type { IngredientRowT, IngredientUnitT } from '@/insforge/schemas';
import { formatMXN } from '@/domain/money';

const UNITS: IngredientUnitT[] = ['g', 'ml', 'unit'];

export default function IngredientsScreen() {
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const orgId = me?.org_id ?? '';

  const q = useQuery({
    queryKey: ['ingredients', orgId],
    queryFn: () => fetchIngredients(orgId),
    enabled: !!orgId,
  });

  const upsert = useUpsertIngredient(orgId);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<IngredientUnitT>('g');
  const [costText, setCostText] = useState('');

  if (me && me.role !== 'admin') {
    return <DeniedScreen />;
  }

  function handleAdd() {
    const trimmed = name.trim();
    const cost = Number(costText.replace(',', '.'));
    if (!trimmed) {
      Alert.alert('Name required', 'Type an ingredient name.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      Alert.alert('Invalid cost', 'Cost per unit must be a non-negative number.');
      return;
    }
    upsert.mutate(
      { name: trimmed, unit, costCentsPerUnit: cost, active: true },
      {
        onSuccess: () => {
          setName('');
          setCostText('');
        },
        onError: (e) =>
          Alert.alert('Could not add', String((e as Error).message)),
      }
    );
  }

  function handleToggleActive(ing: IngredientRowT) {
    upsert.mutate(
      {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        costCentsPerUnit: ing.cost_cents_per_unit,
        active: !ing.active,
      },
      {
        onError: (e) =>
          Alert.alert('Could not update', String((e as Error).message)),
      }
    );
  }

  const items = q.data ?? [];

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Ingredients" />
      </View>

      <Card style={styles.addCard}>
        <Text variant="label">Add ingredient</Text>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Tortilla maíz"
        />
        <View style={styles.unitRow}>
          {UNITS.map((u) => (
            <Chip
              key={u}
              label={u}
              selected={u === unit}
              onPress={() => setUnit(u)}
            />
          ))}
        </View>
        <TextField
          label="Cost per unit (cents)"
          hint="Fractional cents OK. e.g. 2.2 ¢/g for $22/kg tortilla."
          keyboardType="decimal-pad"
          value={costText}
          onChangeText={setCostText}
        />
        <Button
          label="Add"
          onPress={handleAdd}
          loading={upsert.isPending}
          disabled={upsert.isPending}
        />
      </Card>

      {q.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="leaf-outline"
              title="No ingredients yet"
              subtitle="Add one above to start tracking costs."
            />
          }
          renderItem={({ item }) => (
            <Card padded={false} style={styles.row}>
              <View style={styles.rowInner}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" style={!item.active && styles.dim}>
                    {item.name}
                  </Text>
                  <Text variant="footnote">
                    {formatMXN(Math.round(item.cost_cents_per_unit))}/{item.unit}
                    {!item.active ? ' · inactive' : ''}
                  </Text>
                </View>
                <Button
                  label={item.active ? 'Deactivate' : 'Activate'}
                  variant="secondary"
                  onPress={() => handleToggleActive(item)}
                />
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

function DeniedScreen() {
  return (
    <Screen>
      <ScreenHeader showBack title="Ingredients" />
      <View style={styles.deniedWrap}>
        <Ionicons name="lock-closed-outline" size={32} color={color.textTertiary} />
        <Text variant="bodyStrong" align="center">Permission denied</Text>
        <Text variant="bodySm" align="center">Only admins can manage ingredients.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addCard: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  unitRow: { flexDirection: 'row', gap: space.xs },
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
