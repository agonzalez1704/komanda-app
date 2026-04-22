import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchKomandaById, fetchItemsForKomanda } from '@/insforge/queries/komandas';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { calculateTotal } from '@/domain/total';
import { formatMXN } from '@/domain/money';
import { displayIdentifier } from '@/domain/komandaNumber';
import { useCloseKomanda } from '@/mutations/useCloseKomanda';
import { shareReceipt } from '@/receipt/shareReceipt';
import type { PaymentMethodT } from '@/insforge/schemas';

const METHODS: { key: PaymentMethodT; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'transfer', label: 'Transfer' },
];

export default function Close() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const komanda = useQuery({ queryKey: ['komanda', id], queryFn: () => fetchKomandaById(id!), enabled: !!id });
  const items = useQuery({ queryKey: ['komanda', id, 'items'], queryFn: () => fetchItemsForKomanda(id!), enabled: !!id });
  const membership = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const close = useCloseKomanda();

  const [method, setMethod] = useState<PaymentMethodT | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!id || komanda.isLoading || items.isLoading || membership.isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!komanda.data || !membership.data) return <Text>Not found</Text>;

  const total = calculateTotal(items.data ?? []);

  async function confirmAndShare() {
    if (!method || !komanda.data || !membership.data) return;
    setSubmitting(true);
    try {
      const closed_at = new Date().toISOString();
      await close.mutateAsync({
        komanda_id: id!,
        payment_method: method,
        total_cents: total,
        closed_at,
      });
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
        totalCents: total,
        paymentMethod: method,
      });
      router.replace('/(app)/komandas');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Close &amp; charge</Text>
      <Text style={styles.id}>{displayIdentifier(komanda.data)}</Text>
      <View style={styles.itemsBlock}>
        {(items.data ?? []).map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemQty}>{it.quantity}×</Text>
            <Text style={{ flex: 1 }}>
              {it.product_name_snapshot}{it.variant_name_snapshot ? ` (${it.variant_name_snapshot})` : ''}
            </Text>
            <Text>{formatMXN(it.quantity * it.unit_price_cents)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.total}>{formatMXN(total)}</Text>
      </View>
      <Text style={styles.iva}>IVA incluido</Text>

      <Text style={styles.label}>Payment method</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setMethod(m.key)}
            style={[styles.methodChip, method === m.key && styles.methodChipActive]}
          >
            <Text style={[styles.methodText, method === m.key && styles.methodTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={confirmAndShare}
        disabled={!method || submitting}
        style={[styles.primary, (!method || submitting) && styles.primaryDisabled]}
      >
        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Confirm &amp; share receipt</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  id: { fontSize: 14, color: '#737373' },
  itemsBlock: { backgroundColor: 'white', borderRadius: 10, padding: 12, marginTop: 8 },
  itemRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  itemQty: { width: 28, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  totalLabel: { fontSize: 18, fontWeight: '600' },
  total: { fontSize: 24, fontWeight: '800' },
  iva: { fontSize: 11, color: '#737373', textAlign: 'right' },
  label: { fontSize: 12, color: '#737373', textTransform: 'uppercase', marginTop: 16 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#e5e5e5', borderRadius: 10 },
  methodChipActive: { backgroundColor: '#111827' },
  methodText: { fontSize: 15, color: '#404040' },
  methodTextActive: { color: 'white', fontWeight: '700' },
  primary: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
