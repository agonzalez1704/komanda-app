import { Screen, Text } from '@/components/ui';
import { calculateTotal } from '@/domain/total';
import { displayIdentifier } from '@/domain/komandaNumber';
import { ActionFooter } from '@/features/komanda-detail/components/ActionFooter';
import { DetailNavBar } from '@/features/komanda-detail/components/DetailNavBar';
import { HeroTotal } from '@/features/komanda-detail/components/HeroTotal';
import { ItemsList } from '@/features/komanda-detail/components/ItemsList';
import { KomandaTicket } from '@/features/komanda-detail/components/KomandaTicket';
import { StatusSegment } from '@/features/komanda-detail/components/StatusSegment';
import { useKomandaDetail } from '@/features/komanda-detail/hooks/useKomandaDetail';
import { useReshareReceipt } from '@/features/komanda-detail/hooks/useReshareReceipt';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { useRemoveItem } from '@/mutations/useRemoveItem';
import { useUpdateStatus } from '@/mutations/useUpdateStatus';
import { color } from '@/theme/tokens';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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

  // Navigation back: prefer router.back(), but fall back to replacing with
  // the list when the navigator thinks there's nothing to pop. Deep links
  // and some cold-start paths land the user here with an empty history,
  // and a silent "GO_BACK was not handled" warning leaves them stranded.
  function goBack() {
    const canGoBack = router.canGoBack();
    console.log('[KomandaDetail] back canGoBack=', canGoBack);
    if (canGoBack) router.back();
    else router.replace('/(app)/komandas');
  }

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
      <DetailNavBar row={row} onBack={goBack} />
      {closed ? (
        <KomandaTicket
          orgName={membership.data?.organization.name ?? ''}
          identifier={displayIdentifier(row)}
          customerLabel={row.display_name}
          waiterName={membership.data?.display_name ?? '—'}
          openedAtIso={row.opened_at}
          closedAtIso={row.closed_at}
          items={items.map((it) => ({
            id: it.id,
            quantity: it.quantity,
            product_name_snapshot: it.product_name_snapshot,
            variant_name_snapshot: it.variant_name_snapshot,
            unit_price_cents: it.unit_price_cents,
            modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
            note_text: it.note_text,
          }))}
          totalCents={row.total_cents ?? total}
          paymentMethod={row.payment_method}
          bookingRef={row.id.split('-')[0].toUpperCase()}
        />
      ) : (
        <>
          <HeroTotal
            totalCents={total}
            itemCount={itemCount}
            displayName={row.display_name}
          />
          <StatusSegment
            current={row.status}
            onChange={(next) =>
              updateStatus.mutate({ komanda_id: id!, status: next })
            }
          />
          <ItemsList
            items={items}
            closed={closed}
            onRemove={(itemId) => removeItem.mutate(itemId)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
