import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
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
import type { KomandaRowT } from '@/insforge/schemas';
import { color, space } from '@/theme/tokens';

export default function KomandasList() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const { komandas, isLoading, refetch, statsById } = useKomandasData(today);
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
  const totals = useKomandasTotals(komandas, statsById);
  const dateLabel = useMemo(() => formatDateLong(today), [today]);

  const showSummary = !isLoading && komandas.length > 0;

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
      />

      {searchOpen ? (
        <SearchField value={search} onChange={setSearch} />
      ) : null}

      {showSummary ? (
        <RevenueCard
          dayRevenueCents={totals.dayRevenue}
          closedCount={totals.closed}
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
        <FlatList
          data={filtered}
          keyExtractor={(k) => k.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={emptyTitleFor(filter, komandas.length)}
              subtitle={emptySubtitleFor(filter, komandas.length)}
            />
          }
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
});
