import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { listClosedPeriods } from '@/insforge/queries/auditPeriods';
import { can } from '@/auth/permissions';
import type { AuditPeriodRowT } from '@/insforge/schemas';

export default function AuditHistoryList() {
  const router = useRouter();
  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';

  const periods = useQuery({
    queryKey: ['audit-history', orgId],
    queryFn: () => listClosedPeriods(orgId),
    enabled: !!orgId,
  });

  if (me && !can.viewAudit(me.role)) {
    return <Redirect href="/(app)/settings" />;
  }

  const items = periods.data ?? [];

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Audit history" />
      </View>
      {periods.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList<AuditPeriodRowT>
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="No closed periods"
              subtitle="Once you close a day, it shows up here."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(`/(app)/settings/audit-history/${item.id}` as any)
              }
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <Card padded={false} style={styles.row}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={color.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">
                    {formatDate(item.closed_at ?? item.opened_at)}
                  </Text>
                  <Text variant="footnote">
                    Opened {formatDate(item.opened_at)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={color.textTertiary}
                />
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return s;
  }
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
