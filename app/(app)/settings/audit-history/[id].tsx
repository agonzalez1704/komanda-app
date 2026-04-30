import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchPeriod } from '@/insforge/queries/auditPeriods';
import { fetchAuditAggregate } from '@/insforge/queries/audit';
import { useReopenPeriod } from '@/mutations/useReopenPeriod';
import { MetricsCards } from '@/features/audit/components/MetricsCards';
import { CategoryBreakdown } from '@/features/audit/components/CategoryBreakdown';

export default function AuditHistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';

  const periodQuery = useQuery({
    queryKey: ['audit-period-by-id', id],
    queryFn: () => fetchPeriod(id!),
    enabled: !!id,
  });

  const aggregateQuery = useQuery({
    queryKey: ['audit', id],
    queryFn: () => fetchAuditAggregate(id!),
    enabled: !!id,
  });

  const reopen = useReopenPeriod(orgId);
  const [reason, setReason] = useState('');

  function handleReopen() {
    const trimmed = reason.trim();
    if (!trimmed) {
      Alert.alert('Reason required', 'Please give a short reason.');
      return;
    }
    if (!id) return;
    reopen.mutate(
      { periodId: id, reason: trimmed },
      {
        onSuccess: () => {
          setReason('');
          Alert.alert('Reopened', 'Period is open again.');
        },
        onError: (e) =>
          Alert.alert('Could not reopen', String((e as Error).message)),
      },
    );
  }

  const isLoading = periodQuery.isLoading || aggregateQuery.isLoading;
  const aggregate = aggregateQuery.data;

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Closed period" />
      </View>
      {isLoading || !aggregate ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: 120 }}>
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

          {me?.role === 'admin' ? (
            <View style={styles.section}>
              <Card>
                <Text variant="label">Reopen period</Text>
                <Text variant="bodySm" style={{ marginTop: space.xs }}>
                  Reopening allows further edits. The reason is recorded.
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Why are you reopening?"
                  placeholderTextColor={color.textTertiary}
                  style={styles.input}
                />
                <Button
                  label="Reopen"
                  variant="secondary"
                  onPress={handleReopen}
                  loading={reopen.isPending}
                  disabled={reopen.isPending}
                  leadingIcon={
                    <Ionicons
                      name="lock-open-outline"
                      size={18}
                      color={color.textPrimary}
                    />
                  }
                />
              </Card>
            </View>
          ) : null}
        </ScrollView>
      )}
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
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.textPrimary,
    fontSize: 16,
    marginVertical: space.sm,
  },
});
