import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchKomandaById, fetchItemsForKomanda } from '@/insforge/queries/komandas';
import { listKomandaCombos } from '@/insforge/queries/komandaCombos';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { calculateTotal } from '@/domain/total';
import { formatMXN } from '@/domain/money';
import { displayIdentifier } from '@/domain/komandaNumber';
import { useCloseKomanda } from '@/mutations/useCloseKomanda';
import { shareReceipt } from '@/receipt/shareReceipt';
import { announce } from '@/hooks/useReduceMotion';
import type { KomandaRowT, PaymentMethodT } from '@/insforge/schemas';
import {
  Button,
  GlassSurface,
  IconButton,
  Screen,
  Text,
} from '@/components/ui';
import { KomandaTicket } from '@/features/komanda-detail/components/KomandaTicket';
import { color, fontWeight, radius, shadow, space } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const METHODS: { key: PaymentMethodT; label: string; icon: IconName }[] = [
  { key: 'cash', label: 'Cash', icon: 'cash-outline' },
  { key: 'card', label: 'Card', icon: 'card-outline' },
  { key: 'transfer', label: 'Transfer', icon: 'swap-horizontal-outline' },
];

export default function Close() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const cached = qc.getQueryData<KomandaRowT>(['komanda', id]);
  const localOnly = cached != null && cached.number === null;
  const komanda = useQuery({
    queryKey: ['komanda', id],
    queryFn: () => fetchKomandaById(id!),
    enabled: !!id && !localOnly,
  });
  const items = useQuery({
    queryKey: ['komanda', id, 'items'],
    queryFn: () => fetchItemsForKomanda(id!),
    enabled: !!id && !localOnly,
  });
  const combos = useQuery({
    queryKey: ['komanda', id, 'combos'],
    queryFn: () => listKomandaCombos(id!),
    enabled: !!id && !localOnly,
  });
  const membership = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const close = useCloseKomanda();

  const row: KomandaRowT | null = (komanda.data ?? cached) ?? null;

  const [method, setMethod] = useState<PaymentMethodT | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (
    !id ||
    (komanda.isLoading && !cached) ||
    items.isLoading ||
    combos.isLoading ||
    membership.isLoading
  ) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }
  if (!row || !membership.data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="h3">Not found</Text>
        </View>
      </Screen>
    );
  }

  // Free-floating items (combo children carry unit_price_cents = 0 and are
  // priced through their combo's snapshot, so calculateTotal naturally
  // ignores them — but be explicit and filter for clarity).
  const freeItems = (items.data ?? []).filter((it) => it.combo_id == null);
  const itemsTotal = calculateTotal(freeItems);
  const combosTotal = (combos.data ?? []).reduce(
    (sum, c) => sum + c.price_cents_snapshot,
    0,
  );
  const total = itemsTotal + combosTotal;
  // Empty-komanda guard: nothing to charge means closing is meaningless and
  // would generate a $0 receipt. Block at the action button.
  const lineCount = (items.data?.length ?? 0) + (combos.data?.length ?? 0);
  const empty = lineCount === 0;

  async function confirmAndShare() {
    if (!method || !row || !membership.data || submitting) return;
    setSubmitting(true);

    // Snapshot data we need for the receipt before navigation unmounts this
    // screen's query state.
    const closedAt = new Date().toISOString();
    const allItems = items.data ?? [];
    const childByCombo = new Map<string, typeof allItems>();
    for (const it of allItems) {
      if (it.combo_id) {
        const arr = childByCombo.get(it.combo_id) ?? [];
        arr.push(it);
        childByCombo.set(it.combo_id, arr);
      }
    }
    const receiptInput = {
      orgName: membership.data.organization.name,
      identifier: displayIdentifier(row),
      customerLabel: row.display_name,
      waiterName: membership.data.display_name,
      openedAtIso: row.opened_at,
      closedAtIso: closedAt,
      items: allItems
        .filter((it) => it.combo_id == null)
        .map((it) => ({
          quantity: it.quantity,
          product_name_snapshot: it.product_name_snapshot,
          variant_name_snapshot: it.variant_name_snapshot,
          unit_price_cents: it.unit_price_cents,
          modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
          note_text: it.note_text,
        })),
      combos: (combos.data ?? []).map((c) => ({
        id: c.id,
        name_snapshot: c.name_snapshot,
        price_cents_snapshot: c.price_cents_snapshot,
        children: (childByCombo.get(c.id) ?? []).map((it) => ({
          quantity: it.quantity,
          product_name_snapshot: it.product_name_snapshot,
          variant_name_snapshot: it.variant_name_snapshot,
          unit_price_cents: it.unit_price_cents,
          modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
          note_text: it.note_text,
        })),
      })),
      totalCents: total,
      paymentMethod: method,
      bookingRef: row.id.split('-')[0].toUpperCase(),
    };

    try {
      await close.mutateAsync({
        komanda_id: id!,
        payment_method: method,
        total_cents: total,
        closed_at: closedAt,
      });
    } catch (err) {
      // Close itself failed — keep the user here so they can retry.
      setSubmitting(false);
      Alert.alert(
        'Could not close',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return;
    }

    announce(`Komanda closed. Total ${formatMXN(total)}.`);

    // Navigate right away — the close is committed regardless of what
    // happens with the share sheet. Sharing hanging on iOS (share sheet
    // dismissal, print-to-PDF on simulator) must never trap the user here.
    router.replace('/(app)/komandas');

    // Background share. Any failure is surfaced after navigation so the
    // user isn't stuck on a dead screen with a spinner.
    void shareReceipt(receiptInput).catch((err) => {
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Receipt share failed', message, [{ text: 'OK' }]);
    });
  }

  return (
    <Screen
      scrollable
      padded={false}
      contentContainerStyle={{ paddingBottom: 140 }}
      floatingFooter
      footer={
        <GlassSurface radius={radius.xxl} contentStyle={styles.actionBar}>
          <Button
            label={empty ? 'Sin platillos para cobrar' : 'Confirmar y compartir recibo'}
            onPress={confirmAndShare}
            disabled={!method || empty}
            loading={submitting}
            leadingIcon={<Ionicons name="share-outline" size={18} color={color.primaryOn} />}
          />
        </GlassSurface>
      }
    >
      <View style={styles.hdrPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.hdrInner}>
          <IconButton
            glass
            name="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <View style={{ flex: 1, paddingLeft: space.xs }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: color.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              Close &amp; charge
            </Text>
            <Text variant="h3" mono numberOfLines={1}>
              {displayIdentifier(row)}
            </Text>
          </View>
        </GlassSurface>
      </View>

      <View style={styles.body}>
        <View style={styles.methodBlock}>
          <Text variant="label">Payment method</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const active = method === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMethod(m.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Payment method: ${m.label}`}
                  style={({ pressed }) => [
                    styles.methodTile,
                    active && styles.methodTileActive,
                    pressed && !active && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name={m.icon}
                    size={22}
                    color={active ? color.primaryOn : color.textPrimary}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: fontWeight.semibold,
                      color: active ? color.primaryOn : color.textPrimary,
                    }}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <KomandaTicket
          orgName={membership.data.organization.name}
          identifier={displayIdentifier(row)}
          customerLabel={row.display_name}
          waiterName={membership.data.display_name}
          openedAtIso={row.opened_at}
          closedAtIso={null}
          items={(items.data ?? []).map((it) => ({
            id: it.id,
            combo_id: it.combo_id,
            quantity: it.quantity,
            product_name_snapshot: it.product_name_snapshot,
            variant_name_snapshot: it.variant_name_snapshot,
            unit_price_cents: it.unit_price_cents,
            modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
            note_text: it.note_text,
          }))}
          combos={combos.data ?? []}
          totalCents={total}
          paymentMethod={method}
          bookingRef={row.id.split('-')[0].toUpperCase()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Floating glass nav pill — inset from edges so WarmCanvas wraps the corners.
  hdrPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  hdrInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 60,
  },

  // Glass wraps the primary CTA — minimal inner padding since Button has its own.
  actionBar: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.xxl,
  },
  receiptHeader: { padding: space.lg, paddingBottom: space.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  totalCard: {
    gap: space.xs,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  methodBlock: { gap: space.sm },
  methodRow: { flexDirection: 'row', gap: space.sm },
  methodTile: {
    flex: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadow.sm,
  },
  methodTileActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
});
