import { useMemo } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, Screen, Text } from '@/components/ui';
import { StuckMutationsBanner } from '@/components/StuckMutationsBanner';
import { FilterBar } from '@/features/komandas-list/components/FilterBar';
import { KomandaListItem } from '@/features/komandas-list/components/KomandaListItem';
import { NewKomandaFab } from '@/features/komandas-list/components/NewKomandaFab';
import { RevenueCard } from '@/features/komandas-list/components/RevenueCard';
import { SearchField } from '@/features/komandas-list/components/SearchField';
import { TopBar } from '@/features/komandas-list/components/TopBar';
import { useKomandasData } from '@/features/komandas-list/hooks/useKomandasData';
import { useKomandasFilter } from '@/features/komandas-list/hooks/useKomandasFilter';
import { useKomandasTotals } from '@/features/komandas-list/hooks/useKomandasTotals';
import { usePullRefresh } from '@/features/komandas-list/hooks/usePullRefresh';
import {
  emptySubtitleFor,
  emptyTitleFor,
} from '@/features/komandas-list/utils/emptyCopy';
import { formatDateLong } from '@/features/komandas-list/utils/formatDateLong';
import { groupKomandasByDay } from '@/features/komandas-list/utils/groupByDay';
import { fetchMyMembership } from '@/insforge/queries/membership';
import type { KomandaRowT } from '@/insforge/schemas';
import { can } from '@/auth/permissions';
import { color, fontWeight, space } from '@/theme/tokens';

export default function KomandasList() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  // Route guard: cooks have no working komanda surface yet — bounce them to
  // Settings, the only place currently usable for that role. The (app)
  // layout has already gated for an existing membership, so `me` is
  // reliably non-null by the time this screen mounts.
  const { data: me } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });

  const { komandas, isLoading, refetch, statsById } = useKomandasData();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const {
    filter,
    setFilter,
    search,
    setSearch,
    searchOpen,
    toggleSearch,
    filtered,
  } = useKomandasFilter(komandas);
  const totals = useKomandasTotals(komandas, statsById, today);
  const dateLabel = useMemo(() => formatDateLong(today), [today]);

  const sections = useMemo(
    () => groupKomandasByDay(filtered, today),
    [filtered, today],
  );

  if (me && !can.workKomanda(me.role)) {
    return <Redirect href="/(app)/settings" />;
  }

  // Revenue/summary cards expose money totals — gated to roles that can view
  // audit (admin + cashier). Waiters and cooks see only the komandas list.
  const showSummary =
    !isLoading && komandas.length > 0 && !!me && can.viewAudit(me.role);

  function openKomanda(k: KomandaRowT) {
    const href = `/(app)/komandas/${k.id}` as const;
    console.log('[KomandasList] push ->', href);
    router.push(href);
  }

  return (
    <Screen padded={false} edges={['top']} floatingFooter>
      <TopBar
        dateLabel={dateLabel}
        searchOpen={searchOpen}
        onToggleSearch={toggleSearch}
        onOpenSettings={() => router.push('/(app)/settings')}
        onOpenAudit={
          me && can.viewAudit(me.role)
            ? () => router.push('/(app)/audit')
            : undefined
        }
      />

      {searchOpen ? (
        <SearchField value={search} onChange={setSearch} />
      ) : null}

      {showSummary ? (
        <RevenueCard
          dayRevenueCents={totals.dayRevenue}
          closedCount={totals.dayClosed}
          activeCount={totals.active}
          itemsSold={totals.itemsSold}
        />
      ) : null}

      {showSummary ? (
        <FilterBar filter={filter} onChange={setFilter} totals={totals} />
      ) : null}

      <StuckMutationsBanner />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(k) => k.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={emptyTitleFor(filter, komandas.length)}
              subtitle={emptySubtitleFor(filter, komandas.length)}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <KomandaListItem
              komanda={item}
              stats={statsById.get(item.id) ?? { count: 0, total: 0 }}
              onOpen={openKomanda}
            />
          )}
        />
      )}

      <NewKomandaFab onPress={() => router.push('/(app)/komandas/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: 120,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: color.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
