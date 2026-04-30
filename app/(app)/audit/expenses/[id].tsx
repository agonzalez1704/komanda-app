import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchExpense } from '@/insforge/queries/expenses';
import { fetchPeriod } from '@/insforge/queries/auditPeriods';
import { listExpenseCategories } from '@/insforge/queries/expenseCategories';
import { useVoidExpense } from '@/mutations/useVoidExpense';
import { useSession } from '@/insforge/session';
import { formatMXN } from '@/domain/money';
import { canEditExpense } from '@/domain/expenseEditability';

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();

  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';

  const expenseQuery = useQuery({
    queryKey: ['expense', id],
    queryFn: () => fetchExpense(id!),
    enabled: !!id,
  });

  const periodQuery = useQuery({
    queryKey: ['audit-period-by-id', expenseQuery.data?.period_id],
    queryFn: () => fetchPeriod(expenseQuery.data!.period_id),
    enabled: !!expenseQuery.data?.period_id,
  });

  const categoriesQuery = useQuery({
    queryKey: ['expense-categories', orgId],
    queryFn: () => listExpenseCategories(orgId),
    enabled: !!orgId,
  });

  const voidMutation = useVoidExpense(expenseQuery.data?.period_id ?? '');

  const expense = expenseQuery.data;
  const period = periodQuery.data;
  const isLoading = expenseQuery.isLoading || periodQuery.isLoading;

  // Edit form is intentionally not implemented yet — see plan Task 17.
  // We still compute editability so we can hide the absent button cleanly.
  const userId =
    session.status === 'signed-in' ? session.session.userId : null;
  const editable =
    expense && period && userId
      ? canEditExpense({
          expense,
          period: { status: period.status },
          currentUserId: userId,
          now: Date.now(),
        })
      : false;
  void editable; // silence unused-warning while edit form is deferred

  const canVoid =
    !!expense &&
    !!period &&
    me?.role === 'admin' &&
    period.status === 'open' &&
    !expense.voided;

  function handleVoid() {
    if (!expense) return;
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Void expense?',
        'Type a short reason. This is recorded in the audit log.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Void',
            style: 'destructive',
            onPress: (reason?: string) => {
              const trimmed = (reason ?? '').trim();
              if (!trimmed) {
                Alert.alert('Reason required', 'Please give a short reason.');
                return;
              }
              voidMutation.mutate(
                { id: expense.id, reason: trimmed },
                {
                  onError: (e) =>
                    Alert.alert(
                      'Could not void',
                      String((e as Error).message),
                    ),
                },
              );
            },
          },
        ],
        'plain-text',
      );
    } else {
      // Known UX gap: Android lacks Alert.prompt. Use iOS to void with a
      // custom reason; Android voids with a generic placeholder for now.
      Alert.alert(
        'Void expense?',
        'A reason will be recorded as "voided" — use iOS to enter a custom reason.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Void',
            style: 'destructive',
            onPress: () =>
              voidMutation.mutate(
                { id: expense.id, reason: 'voided' },
                {
                  onError: (e) =>
                    Alert.alert(
                      'Could not void',
                      String((e as Error).message),
                    ),
                },
              ),
          },
        ],
      );
    }
  }

  const categoryName = (() => {
    if (!expense) return '';
    if (expense.category_id) {
      const c = (categoriesQuery.data ?? []).find(
        (x) => x.id === expense.category_id,
      );
      return c?.name ?? 'Other';
    }
    return expense.category_other_label ?? 'Other';
  })();

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Expense" />
      </View>
      {isLoading || !expense ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: 120 }}>
          <View style={styles.section}>
            <Card>
              <Text variant="label">Amount</Text>
              <Text
                mono
                style={[
                  styles.bigAmount,
                  expense.voided && {
                    textDecorationLine: 'line-through',
                    color: color.textTertiary,
                  },
                ]}
              >
                {formatMXN(expense.amount_cents)}
              </Text>
              {expense.voided ? (
                <Text variant="footnote" style={{ color: color.danger }}>
                  Voided{expense.void_reason ? ` — ${expense.void_reason}` : ''}
                </Text>
              ) : null}
            </Card>
          </View>

          <View style={styles.section}>
            <Card padded={false}>
              <Row label="Category" value={categoryName} />
              <Divider style={{ marginLeft: space.lg }} />
              <Row
                label="Paid by"
                value={expense.paid_by}
                capitalize
              />
              <Divider style={{ marginLeft: space.lg }} />
              <Row label="Note" value={expense.note} />
            </Card>
          </View>

          {canVoid ? (
            <View style={styles.section}>
              <Button
                label="Void expense"
                variant="destructive"
                onPress={handleVoid}
                loading={voidMutation.isPending}
                disabled={voidMutation.isPending}
                leadingIcon={
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color={color.textInverse}
                  />
                }
              />
            </View>
          ) : null}

          {/* Edit form deferred per plan: see Task 17 — canEditExpense is
              wired for when the form lands. */}
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text variant="caption">{label}</Text>
      <Text
        variant="bodyStrong"
        style={capitalize ? { textTransform: 'capitalize' } : undefined}
      >
        {value}
      </Text>
    </View>
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
  },
  bigAmount: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: space.xs,
  },
  row: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: 2,
  },
});
