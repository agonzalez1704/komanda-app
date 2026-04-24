import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Screen, Text } from '@/components/ui';
import { calculateTotal } from '@/domain/total';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { useUpdateStatus } from '@/mutations/useUpdateStatus';
import { useRemoveItem } from '@/mutations/useRemoveItem';
import { ActionFooter } from '@/features/komanda-detail/components/ActionFooter';
import { DetailNavBar } from '@/features/komanda-detail/components/DetailNavBar';
import { HeroTotal } from '@/features/komanda-detail/components/HeroTotal';
import { ItemsList } from '@/features/komanda-detail/components/ItemsList';
import { StatusSegment } from '@/features/komanda-detail/components/StatusSegment';
import { TotalCard } from '@/features/komanda-detail/components/TotalCard';
import { useKomandaDetail } from '@/features/komanda-detail/hooks/useKomandaDetail';
import { useReshareReceipt } from '@/features/komanda-detail/hooks/useReshareReceipt';
import { color } from '@/theme/tokens';

export default function KomandaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  console.log('[KomandaDetail] mount id=', id);
  const router = useRouter();

  const { row, items, isLoading, isMissing } = useKomandaDetail(id);
  const membership = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const updateStatus = useUpdateStatus();
  const removeItem = useRemoveItem(id!);
  const reshare = useReshareReceipt({
    row,
    items,
    membership: membership.data,
  });

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }
  if (isMissing || !row) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="h3" align="center">
            Komanda not found.
          </Text>
        </View>
      </Screen>
    );
  }

  const closed = row.status === 'closed';
  const total = calculateTotal(items);
  const itemCount = items.reduce((a, it) => a + it.quantity, 0);
  const lineCount = items.length;

  const footer = (
    <ActionFooter
      closed={closed}
      lineCount={lineCount}
      totalCents={total}
      onAdd={() => router.push(`/(app)/komandas/${id}/add-item`)}
      onClose={() => router.push(`/(app)/komandas/${id}/close`)}
      onReshare={reshare}
    />
  );

  return (
    <Screen scrollable padded={false} bottomInset={120} footer={footer} floatingFooter>
      <DetailNavBar row={row} onBack={() => router.back()} />
      <HeroTotal
        totalCents={total}
        itemCount={itemCount}
        displayName={row.display_name}
      />
      {!closed ? (
        <StatusSegment
          current={row.status}
          onChange={(next) =>
            updateStatus.mutate({ komanda_id: id!, status: next })
          }
        />
      ) : null}
      <ItemsList
        items={items}
        closed={closed}
        onRemove={(itemId) => removeItem.mutate(itemId)}
      />
      {lineCount > 0 ? <TotalCard totalCents={total} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
