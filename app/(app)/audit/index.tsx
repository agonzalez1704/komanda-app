import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Divider,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { can } from '@/auth/permissions';
import { formatMXN } from '@/domain/money';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import { fetchAuditAggregate } from '@/insforge/queries/audit';
import { listExpensesForPeriod } from '@/insforge/queries/expenses';
import { insforge } from '@/insforge/client';
import { useCloseDay } from '@/mutations/useCloseDay';
import { MetricsCards } from '@/features/audit/components/MetricsCards';
import { CategoryBreakdown } from '@/features/audit/components/CategoryBreakdown';
import { RecentList } from '@/features/audit/components/RecentList';
import { AddExpenseSheet } from '@/features/audit/components/AddExpenseSheet';
import { CloseDayConfirm } from '@/features/audit/components/CloseDayConfirm';
import type { ExpenseRowT } from '@/insforge/schemas';

export default function AuditScreen() {
  const router = useRouter();

  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';

  const periodQuery = useQuery({
    queryKey: ['audit-period', orgId],
    queryFn: () => fetchOpenPeriod(orgId),
    enabled: !!orgId,
  });
  const periodId = periodQuery.data?.id;

  const aggregateQuery = useQuery({
    queryKey: ['audit', periodId],
    queryFn: () => fetchAuditAggregate(periodId!),
    enabled: !!periodId,
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses', periodId],
    queryFn: () => listExpensesForPeriod(periodId!),
    enabled: !!periodId,
  });

  const openKomandasCount = useQuery({
    queryKey: ['open-komanda-count', periodId],
    queryFn: async () => {
      const { count, error } = await insforge.database
        .from('komandas')
        .select('id', { count: 'exact', head: true })
        .eq('period_id', periodId!)
        .neq('status', 'closed');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!periodId,
  });

  const closeDay = useCloseDay(orgId);

  const [addOpen, setAddOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  // Gate AFTER all hooks (rules of hooks).
  if (me && !can.viewAudit(me.role)) {
    return <Redirect href="/(app)/komandas" />;
  }

  const aggregate = aggregateQuery.data;
  const expenses = expensesQuery.data ?? [];
  const openCount = openKomandasCount.data ?? 0;
  const blocked = openCount > 0;

  const closeLabel = blocked ? `Close day (${openCount} open)` : 'Close day';

  function handleConfirmClose() {
    closeDay.mutate(undefined, {
      onSuccess: () => {
        setCloseOpen(false);
        router.replace('/(app)/settings/audit-history' as any);
      },
    });
  }

  const isLoading =
    periodQuery.isLoading || aggregateQuery.isLoading || expensesQuery.isLoading;

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Audit" />
      </View>

      {isLoading || !aggregate ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: space.lg, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Button
              label={closeLabel}
              variant="secondary"
              onPress={() => setCloseOpen(true)}
              leadingIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={color.textPrimary}
                />
              }
            />
          </View>

          <View style={styles.section}>
            <MetricsCards data={aggregate} />
          </View>

          <View style={styles.section}>
            <CategoryBreakdown
              title="Earnings by category"
              byCategory={aggregate.earnings.byCategory}
            />
          </View>

          <View style={styles.section}>
            <CategoryBreakdown
              title="Expenses by category"
              byCategory={aggregate.expenses.byCategory}
            />
          </View>

          <View style={styles.section}>
            <Text variant="label">Per waiter</Text>
            <Card padded={false}>
              {Object.keys(aggregate.earnings.perWaiter).length === 0 ? (
                <View style={styles.empty}>
                  <Text variant="bodySm">Nothing yet.</Text>
                </View>
              ) : (
                Object.entries(aggregate.earnings.perWaiter)
                  .sort(([, a], [, b]) => b.totalCents - a.totalCents)
                  .map(([uid, stats], idx) => (
                    <View key={uid}>
                      {idx > 0 ? (
                        <Divider style={{ marginLeft: space.lg }} />
                      ) : null}
                      <View style={styles.waiterRow}>
                        <Text
                          variant="body"
                          style={{ flex: 1 }}
                          numberOfLines={1}
                        >
                          {uid.slice(0, 8)}…
                        </Text>
                        <Text variant="footnote" style={{ marginRight: space.md }}>
                          {stats.count} closed
                        </Text>
                        <Text mono variant="bodyStrong">
                          {formatMXN(stats.totalCents)}
                        </Text>
                      </View>
                    </View>
                  ))
              )}
            </Card>
          </View>

          <View style={styles.section}>
            <RecentList<ExpenseRowT>
              title="Recent expenses"
              items={expenses}
              onSeeAll={() => router.push('/(app)/audit/expenses' as any)}
              renderItem={(e) => (
                <Pressable
                  onPress={() =>
                    router.push(`/(app)/audit/expenses/${e.id}` as any)
                  }
                  style={({ pressed }) => [
                    styles.expenseRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="bodyStrong"
                      numberOfLines={1}
                      style={
                        e.voided
                          ? { textDecorationLine: 'line-through', color: color.textTertiary }
                          : undefined
                      }
                    >
                      {e.note}
                    </Text>
                    <Text variant="footnote" style={{ textTransform: 'capitalize' }}>
                      {e.paid_by}
                    </Text>
                  </View>
                  <Text
                    mono
                    variant="bodyStrong"
                    style={
                      e.voided
                        ? { textDecorationLine: 'line-through', color: color.textTertiary }
                        : undefined
                    }
                  >
                    {formatMXN(e.amount_cents)}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </ScrollView>
      )}

      <Pressable
        onPress={() => setAddOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
        ]}
      >
        <Ionicons name="add" size={28} color={color.primaryOn} />
      </Pressable>

      {addOpen && orgId && periodId ? (
        <AddExpenseSheet
          orgId={orgId}
          periodId={periodId}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {closeOpen && aggregate ? (
        <CloseDayConfirm
          data={aggregate}
          openKomandasCount={openCount}
          onCancel={() => setCloseOpen(false)}
          onConfirm={handleConfirmClose}
          pending={closeDay.isPending}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxxxl,
  },
  empty: {
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  waiterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
