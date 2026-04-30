import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import { listExpensesForPeriod } from '@/insforge/queries/expenses';
import { formatMXN } from '@/domain/money';
import type { ExpenseRowT } from '@/insforge/schemas';

export default function ExpensesList() {
  const router = useRouter();
  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';

  const period = useQuery({
    queryKey: ['audit-period', orgId],
    queryFn: () => fetchOpenPeriod(orgId),
    enabled: !!orgId,
  });

  const expenses = useQuery({
    queryKey: ['expenses', period.data?.id],
    queryFn: () => listExpensesForPeriod(period.data!.id),
    enabled: !!period.data?.id,
  });

  const items = expenses.data ?? [];
  const isLoading = period.isLoading || expenses.isLoading;

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Expenses" />
      </View>
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList<ExpenseRowT>
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="cash-outline"
              title="No expenses yet"
              subtitle="Tap + on the audit screen to add one."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(`/(app)/audit/expenses/${item.id}` as any)
              }
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <Card padded={false} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="bodyStrong"
                    numberOfLines={1}
                    style={
                      item.voided
                        ? { textDecorationLine: 'line-through', color: color.textTertiary }
                        : undefined
                    }
                  >
                    {item.note}
                  </Text>
                  <Text variant="footnote" style={{ textTransform: 'capitalize' }}>
                    {item.paid_by}
                  </Text>
                </View>
                <Text
                  mono
                  variant="bodyStrong"
                  style={
                    item.voided
                      ? { textDecorationLine: 'line-through', color: color.textTertiary }
                      : undefined
                  }
                >
                  {formatMXN(item.amount_cents)}
                </Text>
              </Card>
            </Pressable>
          )}
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
});
