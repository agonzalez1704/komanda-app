import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchKomandaById, fetchItemsForKomanda } from '@/insforge/queries/komandas';
import { calculateTotal } from '@/domain/total';
import { formatMXN } from '@/domain/money';
import { displayIdentifier } from '@/domain/komandaNumber';
import { StatusPill } from '@/components/StatusPill';
import { useUpdateStatus } from '@/mutations/useUpdateStatus';
import { useRemoveItem } from '@/mutations/useRemoveItem';
import { shareReceipt } from '@/receipt/shareReceipt';
import { fetchMyMembership } from '@/insforge/queries/membership';
import type { KomandaRowT, KomandaStatusT } from '@/insforge/schemas';
import {
  Button,
  Card,
  Divider,
  GlassSurface,
  IconButton,
  Screen,
  Text,
} from '@/components/ui';
import { color, fontWeight, hitSlop, palette, radius, space } from '@/theme/tokens';

/**
 * Condensed 3-way status segmented control — Open → Pending → Served. "Closed"
 * is a terminal state reached via the Close & Charge flow, not a chip on this
 * screen. Collapsing from a 2×2 grid to a single row frees vertical space and
 * restores a real visual rhythm to the page.
 */
const STATUSES: {
  key: Exclude<KomandaStatusT, 'closed'>;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { key: 'open', label: 'Open', icon: 'ellipse-outline' },
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'served', label: 'Served', icon: 'checkmark-circle-outline' },
];

export default function KomandaDetail() {
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
  const membership = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const updateStatus = useUpdateStatus();
  const removeItem = useRemoveItem(id!);

  const row: KomandaRowT | null = (komanda.data ?? cached) ?? null;

  if (!id || (komanda.isLoading && !cached)) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }
  if (!row) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="h3" align="center">Komanda not found.</Text>
        </View>
      </Screen>
    );
  }

  const closed = row.status === 'closed';
  const total = calculateTotal(items.data ?? []);
  const itemCount = (items.data ?? []).reduce((acc, it) => acc + it.quantity, 0);
  const lineCount = items.data?.length ?? 0;

  async function reshare() {
    if (!row || !membership.data || row.payment_method === null) return;
    await shareReceipt({
      orgName: membership.data.organization.name,
      identifier: displayIdentifier(row),
      waiterName: membership.data.display_name,
      openedAtIso: row.opened_at,
      items: (items.data ?? []).map((it) => ({
        quantity: it.quantity,
        product_name_snapshot: it.product_name_snapshot,
        variant_name_snapshot: it.variant_name_snapshot,
        unit_price_cents: it.unit_price_cents,
        modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
        note_text: it.note_text,
      })),
      totalCents: row.total_cents ?? 0,
      paymentMethod: row.payment_method,
    });
  }

  // Footer is a floating Liquid Glass action bar. For closed komandas we
  // keep a single primary button (re-share); otherwise we split Add / Close
  // inside one glass pill so they read as a paired action.
  const footer = closed ? (
    <GlassSurface radius={radius.xxl} contentStyle={styles.actionBarClosed}>
      <Button
        label="Share receipt again"
        onPress={reshare}
        leadingIcon={<Ionicons name="share-outline" size={18} color={color.primaryOn} />}
      />
    </GlassSurface>
  ) : (
    // NB: we deliberately avoid `<Link asChild>` here. Our Button wraps its
    // Pressable's onPress in a haptic-adding handlePress, and expo-router's
    // `asChild` cloneElement path didn't reliably hit that wrapper when two
    // Link+Button pairs sat side-by-side — the "Close" tap would fire the
    // sibling's navigation, dumping the user on the add-item (menu) screen.
    // Plain `router.push` from the Button's own onPress is the canonical,
    // bug-free pattern for custom press components under expo-router.
    <GlassSurface radius={radius.xxl} contentStyle={styles.actionBar}>
      <Button
        label={lineCount === 0 ? 'Add first item' : 'Add item'}
        variant="secondary"
        style={{ flex: 1 }}
        leadingIcon={<Ionicons name="add" size={20} color={color.textPrimary} />}
        onPress={() => router.push(`/(app)/komandas/${id}/add-item`)}
      />
      <Button
        label={lineCount === 0 ? 'Close' : `Close · ${formatMXN(total)}`}
        disabled={lineCount === 0}
        style={{ flex: 1.3 }}
        leadingIcon={<Ionicons name="card-outline" size={18} color={color.primaryOn} />}
        onPress={() => router.push(`/(app)/komandas/${id}/close`)}
      />
    </GlassSurface>
  );

  return (
    <Screen
      scrollable
      padded={false}
      bottomInset={120}
      footer={footer}
      floatingFooter
    >
      {/* ------------------------------------------------------------------ */}
      {/* Floating glass nav — back chevron + status pill. No more black hero */}
      {/* card; the identifier and total now live on a light receipt-style    */}
      {/* card below so the warm canvas dominates the page.                   */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.navPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.navInner}>
          <IconButton
            glass
            name="chevron-back"
            accessibilityLabel="Back"
            onPress={() => router.back()}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: color.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              Komanda
            </Text>
            <Text
              mono
              numberOfLines={1}
              style={{
                fontSize: 17,
                fontWeight: fontWeight.bold,
                color: color.textPrimary,
                letterSpacing: -0.2,
              }}
            >
              {displayIdentifier(row)}
            </Text>
          </View>
          <StatusPill status={row.status} />
        </GlassSurface>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Hero total — light surface with saffron accent. This is CONTENT,   */}
      {/* not chrome, so it stays solid.                                     */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.heroPad}>
        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: color.textTertiary,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Running total
            </Text>
            <Text
              mono
              style={{
                fontSize: 38,
                lineHeight: 42,
                fontWeight: fontWeight.heavy,
                color: color.textPrimary,
                letterSpacing: -0.5,
                marginTop: 2,
              }}
            >
              {formatMXN(total)}
            </Text>
            {row.display_name ? (
              <Text variant="footnote" style={{ marginTop: 2 }}>
                {row.display_name}
              </Text>
            ) : null}
          </View>
          <View style={styles.heroItemsChip}>
            <Ionicons name="fast-food" size={14} color={palette.saffron600} />
            <Text
              mono
              style={{
                color: palette.terracotta600,
                fontWeight: fontWeight.bold,
                fontSize: 14,
              }}
            >
              {itemCount}
            </Text>
          </View>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Status — 3-chip glass segmented control. "Closed" is reached via   */}
      {/* the Close & Charge flow, not as a chip here.                       */}
      {/* ------------------------------------------------------------------ */}
      {!closed ? (
        <View style={styles.section}>
          <Text variant="label" style={styles.sectionLabel}>Status</Text>
          <GlassSurface radius={radius.full} contentStyle={styles.segment}>
            {STATUSES.map((s) => {
              const active = row.status === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => updateStatus.mutate({ komanda_id: id, status: s.key })}
                  accessibilityRole="button"
                  accessibilityLabel={`Set status to ${s.label}`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.statusChip,
                    active && styles.statusChipActive,
                    pressed && !active && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons
                    name={s.icon}
                    size={16}
                    color={active ? color.primaryOn : color.textSecondary}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: fontWeight.semibold,
                      color: active ? color.primaryOn : color.textPrimary,
                    }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </GlassSurface>
        </View>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Items                                                              */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text variant="label">Items</Text>
          {lineCount > 0 ? (
            <Text variant="caption">
              {lineCount} line{lineCount === 1 ? '' : 's'} · {itemCount} unit{itemCount === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
        <Card padded={false}>
          {lineCount === 0 ? (
            <View style={styles.emptyItems}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="fast-food-outline" size={22} color={palette.terracotta500} />
              </View>
              <Text variant="bodyStrong" align="center">
                No items yet
              </Text>
              <Text variant="footnote" align="center" style={{ maxWidth: 240 }}>
                Tap &ldquo;Add first item&rdquo; below to start building this order.
              </Text>
            </View>
          ) : (
            items.data!.map((it, idx) => (
              <View key={it.id}>
                <View style={styles.itemRow}>
                  <View style={styles.qtyBubble}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: fontWeight.bold,
                        color: color.primary,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {it.quantity}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: fontWeight.bold,
                        color: color.primary,
                        marginTop: -2,
                      }}
                    >
                      ×
                    </Text>
                  </View>
                  <View style={styles.itemBody}>
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {it.product_name_snapshot}
                    </Text>
                    {it.variant_name_snapshot ? (
                      <Text variant="footnote">{it.variant_name_snapshot}</Text>
                    ) : null}
                    {it.modifiers.length > 0 ? (
                      <Text variant="caption" numberOfLines={2}>
                        {it.modifiers.map((m) => m.name_snapshot).join(' · ')}
                      </Text>
                    ) : null}
                    {it.note_text ? (
                      <Text
                        variant="caption"
                        style={{ fontStyle: 'italic', color: palette.ink500 }}
                      >
                        &ldquo;{it.note_text}&rdquo;
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.itemPriceCol}>
                    <Text variant="bodyStrong" mono style={{ fontSize: 15 }}>
                      {formatMXN(it.quantity * it.unit_price_cents)}
                    </Text>
                    {it.quantity > 1 ? (
                      <Text variant="caption" mono>
                        {formatMXN(it.unit_price_cents)} ea
                      </Text>
                    ) : null}
                  </View>
                  {!closed ? (
                    <Pressable
                      onPress={() => removeItem.mutate(it.id)}
                      hitSlop={hitSlop}
                      style={({ pressed }) => [
                        styles.removeBtn,
                        pressed && { opacity: 0.6 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Remove item"
                    >
                      <Ionicons name="close" size={16} color={color.danger} />
                    </Pressable>
                  ) : null}
                </View>
                {idx < lineCount - 1 ? <Divider style={{ marginLeft: 60 }} /> : null}
              </View>
            ))
          )}
        </Card>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Total card — only when there are items, the hero already reads 0  */}
      {/* ------------------------------------------------------------------ */}
      {lineCount > 0 ? (
        <View style={styles.section}>
          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text variant="h3">Total</Text>
              <Text
                mono
                style={{
                  fontSize: 30,
                  fontWeight: fontWeight.heavy,
                  color: color.textPrimary,
                  letterSpacing: -0.3,
                }}
              >
                {formatMXN(total)}
              </Text>
            </View>
            <Text variant="caption" align="right">
              IVA incluido · MXN
            </Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Floating glass nav — inset from edges so WarmCanvas color wraps the corners.
  navPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 60,
  },

  heroPad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  heroItemsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    backgroundColor: palette.saffron50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.saffron100,
  },

  section: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
  },
  sectionLabel: {},
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  // Glass segmented control for status
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 2,
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  statusChipActive: {
    backgroundColor: color.primary,
  },

  emptyItems: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.xs,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: palette.terracotta50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  qtyBubble: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  itemBody: { flex: 1, gap: 2 },
  itemPriceCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.dangerBg,
  },

  totalCard: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: space.lg,
    gap: space.xs,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },

  // Action bar content wrappers (inside the GlassSurface chrome)
  actionBar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  actionBarClosed: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
});
