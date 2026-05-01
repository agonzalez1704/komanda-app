import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { listExpenseCategories } from '@/insforge/queries/expenseCategories';
import { useUpsertExpenseCategory } from '@/mutations/useUpsertExpenseCategory';
import type { ExpenseCategoryRowT } from '@/insforge/schemas';

export default function ExpenseCategoriesScreen() {
  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';

  const categories = useQuery({
    queryKey: ['expense-categories', orgId],
    queryFn: () => listExpenseCategories(orgId),
    enabled: !!orgId,
  });

  const upsert = useUpsertExpenseCategory(orgId);

  const [newName, setNewName] = useState('');

  if (me && me.role !== 'admin') {
    return (
      <Screen>
        <ScreenHeader showBack title="Expense categories" />
        <View style={styles.deniedWrap}>
          <Ionicons
            name="lock-closed-outline"
            size={32}
            color={color.textTertiary}
          />
          <Text variant="bodyStrong" align="center">
            Permission denied
          </Text>
          <Text variant="bodySm" align="center">
            Only admins can manage categories.
          </Text>
        </View>
      </Screen>
    );
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Type a category name.');
      return;
    }
    upsert.mutate(
      { name: trimmed, active: true },
      {
        onSuccess: () => setNewName(''),
        onError: (e) =>
          Alert.alert('Could not add', String((e as Error).message)),
      },
    );
  }

  function handleToggleActive(c: ExpenseCategoryRowT) {
    upsert.mutate(
      {
        id: c.id,
        name: c.name,
        active: !c.active,
        sort_order: c.sort_order,
      },
      {
        onError: (e) =>
          Alert.alert('Could not update', String((e as Error).message)),
      },
    );
  }

  const items = categories.data ?? [];

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Expense categories" />
      </View>
      {categories.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList<ExpenseCategoryRowT>
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="pricetags-outline"
              title="No categories yet"
              subtitle="Add one below to start tracking expenses by category."
            />
          }
          renderItem={({ item }) => (
            <Card padded={false} style={styles.row}>
              <Text
                variant="bodyStrong"
                style={[
                  { flex: 1 },
                  !item.active && { color: color.textTertiary },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Pressable
                onPress={() => handleToggleActive(item)}
                accessibilityRole="button"
                accessibilityLabel={item.active ? 'Hide' : 'Show'}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons
                  name={item.active ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={item.active ? color.textSecondary : color.textTertiary}
                />
              </Pressable>
            </Card>
          )}
          ListFooterComponent={
            <Card style={styles.footer}>
              <Text variant="label">Add category</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Supplies"
                placeholderTextColor={color.textTertiary}
                style={styles.input}
              />
              <Button
                label="Add"
                onPress={handleAdd}
                loading={upsert.isPending}
                disabled={upsert.isPending}
                leadingIcon={
                  <Ionicons name="add" size={18} color={color.primaryOn} />
                }
              />
            </Card>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: 120,
    gap: space.sm,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: space.md,
    gap: space.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.textPrimary,
    fontSize: 16,
  },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
});
