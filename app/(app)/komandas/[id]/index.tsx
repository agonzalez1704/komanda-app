import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchKomandaById, fetchItemsForKomanda } from '@/insforge/queries/komandas';
import { calculateTotal } from '@/domain/total';
import { formatMXN } from '@/domain/money';
import { displayIdentifier } from '@/domain/komandaNumber';
import { StatusPill } from '@/components/StatusPill';
import { useUpdateStatus } from '@/mutations/useUpdateStatus';
import { useRemoveItem } from '@/mutations/useRemoveItem';
import { shareReceipt } from '@/receipt/shareReceipt';
import { fetchMyMembership } from '@/insforge/queries/membership';
import type { KomandaStatusT } from '@/insforge/schemas';

const STATUSES: KomandaStatusT[] = ['open', 'pending', 'served', 'closed'];

export default function KomandaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const komanda = useQuery({ queryKey: ['komanda', id], queryFn: () => fetchKomandaById(id!), enabled: !!id });
  const items = useQuery({ queryKey: ['komanda', id, 'items'], queryFn: () => fetchItemsForKomanda(id!), enabled: !!id });
  const membership = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const updateStatus = useUpdateStatus();
  const removeItem = useRemoveItem(id!);

  if (!id || komanda.isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!komanda.data) return <Text style={styles.missing}>Komanda not found.</Text>;

  const closed = komanda.data.status === 'closed';
  const total = calculateTotal(items.data ?? []);

  async function reshare() {
    if (!komanda.data || !membership.data || komanda.data.payment_method === null) return;
    await shareReceipt({
      orgName: membership.data.organization.name,
      identifier: displayIdentifier(komanda.data),
      waiterName: membership.data.display_name,
      openedAtIso: komanda.data.opened_at,
      items: (items.data ?? []).map((it) => ({
        quantity: it.quantity,
        product_name_snapshot: it.product_name_snapshot,
        variant_name_snapshot: it.variant_name_snapshot,
        unit_price_cents: it.unit_price_cents,
        modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
        note_text: it.note_text,
      })),
      totalCents: komanda.data.total_cents ?? 0,
      paymentMethod: komanda.data.payment_method,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.header}>
        <Text style={styles.id}>{displayIdentifier(komanda.data)}</Text>
        <StatusPill status={komanda.data.status} />
      </View>
      {komanda.data.display_name ? <Text style={styles.display}>{komanda.data.display_name}</Text> : null}

      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            disabled={closed}
            onPress={() => updateStatus.mutate({ komanda_id: id, status: s })}
            style={[
              styles.statusChip,
              komanda.data!.status === s && styles.statusChipActive,
              closed && styles.statusChipDisabled,
            ]}
          >
            <Text style={[styles.statusChipText, komanda.data!.status === s && styles.statusChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.itemsSection}>
        <Text style={styles.sectionHeader}>Items</Text>
        {items.data?.length ? (
          items.data.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <Text style={styles.itemQty}>{it.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {it.product_name_snapshot}
                  {it.variant_name_snapshot ? ` (${it.variant_name_snapshot})` : ''}
                </Text>
                {it.modifiers.length > 0 ? (
                  <Text style={styles.itemMods}>· {it.modifiers.map((m) => m.name_snapshot).join(' · ')}</Text>
                ) : null}
                {it.note_text ? <Text style={styles.itemNote}>{it.note_text}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>{formatMXN(it.quantity * it.unit_price_cents)}</Text>
              {!closed ? (
                <TouchableOpacity onPress={() => removeItem.mutate(it.id)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No items yet.</Text>
        )}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatMXN(total)}</Text>
      </View>
      <Text style={styles.ivaNote}>IVA incluido</Text>

      {!closed ? (
        <>
          <Link href={`/(app)/komandas/${id}/add-item`} asChild>
            <TouchableOpacity style={styles.primary}>
              <Text style={styles.primaryText}>Add item</Text>
            </TouchableOpacity>
          </Link>
          <Link href={`/(app)/komandas/${id}/close`} asChild>
            <TouchableOpacity
              disabled={(items.data?.length ?? 0) === 0}
              style={[styles.secondary, (items.data?.length ?? 0) === 0 && styles.secondaryDisabled]}
            >
              <Text style={styles.secondaryText}>Close &amp; charge</Text>
            </TouchableOpacity>
          </Link>
        </>
      ) : (
        <TouchableOpacity onPress={reshare} style={styles.primary}>
          <Text style={styles.primaryText}>Share receipt again</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12 },
  missing: { padding: 24, fontSize: 16, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  id: { fontSize: 18, fontWeight: '700' },
  display: { fontSize: 14, color: '#404040' },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#e5e5e5' },
  statusChipActive: { backgroundColor: '#111827' },
  statusChipDisabled: { opacity: 0.5 },
  statusChipText: { fontSize: 13, color: '#404040', textTransform: 'capitalize' },
  statusChipTextActive: { color: 'white', fontWeight: '700' },
  itemsSection: { marginTop: 8, backgroundColor: 'white', borderRadius: 10, padding: 12 },
  sectionHeader: { fontSize: 12, color: '#737373', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e5e5' },
  itemQty: { fontSize: 16, fontWeight: '700', width: 28 },
  itemName: { fontSize: 15 },
  itemMods: { fontSize: 12, color: '#737373' },
  itemNote: { fontSize: 12, color: '#737373', fontStyle: 'italic' },
  itemPrice: { fontSize: 15, fontWeight: '600' },
  removeBtn: { paddingHorizontal: 8 },
  removeBtnText: { fontSize: 20, color: '#dc2626' },
  empty: { color: '#737373', fontStyle: 'italic', paddingVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  totalLabel: { fontSize: 18, fontWeight: '600' },
  total: { fontSize: 22, fontWeight: '800' },
  ivaNote: { fontSize: 11, color: '#737373', textAlign: 'right' },
  primary: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryDisabled: { opacity: 0.4 },
  secondaryText: { color: '#111827', fontSize: 16, fontWeight: '700' },
});
