import { useMemo } from 'react';
import { Link, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { fetchKomandasForDate, fetchItemsForKomanda } from '@/insforge/queries/komandas';
import { KomandaCard } from '@/components/KomandaCard';
import { StuckMutationsBanner } from '@/components/StuckMutationsBanner';
import { calculateTotal } from '@/domain/total';

export default function KomandasList() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['komandas', 'today'],
    queryFn: () => fetchKomandasForDate(today),
    staleTime: 1000 * 10,
  });

  return (
    <View style={styles.root}>
      <StuckMutationsBanner />
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Komandas</Text>
        <Link href="/(app)/settings" style={styles.settingsLink}>Settings</Link>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(k) => k.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<Text style={styles.empty}>No komandas yet today.</Text>}
          renderItem={({ item }) => (
            <KomandaRow k={item} onPress={() => router.push(`/(app)/komandas/${item.id}`)} />
          )}
        />
      )}
      <Link href="/(app)/komandas/new" asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+ New komanda</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

function KomandaRow({
  k,
  onPress,
}: {
  k: Parameters<typeof KomandaCard>[0]['k'];
  onPress: () => void;
}) {
  const items = useQuery({
    queryKey: ['komanda', k.id, 'items'],
    queryFn: () => fetchItemsForKomanda(k.id),
    enabled: k.number !== null,
  });
  const total = calculateTotal(items.data ?? []);
  return (
    <KomandaCard
      k={k}
      itemCount={items.data?.length ?? 0}
      runningTotalCents={total}
      onPress={onPress}
      syncedServerSide={k.number !== null}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f5' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white' },
  topTitle: { fontSize: 22, fontWeight: '700' },
  settingsLink: { color: '#2563eb', fontSize: 14 },
  list: { padding: 16, paddingBottom: 96 },
  empty: { textAlign: 'center', color: '#737373', marginTop: 48 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  fabText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
