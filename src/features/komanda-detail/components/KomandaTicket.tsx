import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import {
  color,
  fontWeight,
  palette,
  radius,
  space,
} from '@/theme/tokens';
import type { KomandaComboRowT, PaymentMethodT } from '@/insforge/schemas';
import { groupItemsByCombo } from '@/domain/comboGrouping';
import { formatVariantLabel } from '@/domain/variantLabel';
import { ComboGroup } from './ComboGroup';

/**
 * KomandaTicket — train-ticket-inspired card used for closed komandas
 * and as a live preview on the close screen.
 *
 * Layout mirrors a railway ticket: dark warm card, eyebrow + customer
 * heading, opened→closed time strip, items, three-column meta strip
 * (Booking / Waiter / Payment), bold total and a deterministic barcode
 * footer. Adapts the warm/saffron palette rather than importing a dark
 * theme directly — the gradient reuses the same stops as `StatsHeroCard`
 * so closed receipts feel related to the dashboard hero.
 */

export interface KomandaTicketItem {
  id: string;
  /** When set, this item is a child of the matching combo and renders in
   * the grouped section instead of the free items list. */
  combo_id?: string | null;
  quantity: number;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  variant_2_name_snapshot: string | null;
  unit_price_cents: number;
  modifiers?: { name_snapshot: string }[];
  note_text?: string | null;
}

export interface KomandaTicketProps {
  orgName: string;
  identifier: string;
  customerLabel: string | null;
  waiterName: string;
  openedAtIso: string;
  /** null when in close-preview mode (komanda not yet closed). */
  closedAtIso: string | null;
  items: KomandaTicketItem[];
  /** Combos placed on the komanda. Children are rendered as a single
   * grouped block under the combo's snapshot price. */
  combos?: KomandaComboRowT[];
  totalCents: number;
  /** null in preview if user has not yet picked a method. */
  paymentMethod: PaymentMethodT | null;
  /** Short booking ref derived from komanda.id (e.g. "4F3A1B2C"). */
  bookingRef: string;
}

const PAYMENT_LABEL: Record<PaymentMethodT, string> = {
  cash: 'Cash',
  card: 'Card',
  transfer: 'Transfer',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDuration(openedIso: string, closedIso: string | null): string {
  const start = new Date(openedIso).getTime();
  const end = closedIso ? new Date(closedIso).getTime() : Date.now();
  const totalMin = Math.max(0, Math.floor((end - start) / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${pad2(m)}m`;
}

/**
 * Deterministic barcode bar widths/heights from a seed string. No SVG
 * dep required — caller renders each bar as a `<View>`.
 */
export function barcodeBars(seed: string): Array<{ width: number; height: number }> {
  const out: Array<{ width: number; height: number }> = [];
  const safe = seed.length > 0 ? seed : 'KOMANDA';
  for (let i = 0; i < 36; i++) {
    const c = safe.charCodeAt(i % safe.length) ?? 33;
    out.push({
      width: 1 + (c % 4),
      height: 28 + (c % 16),
    });
  }
  return out;
}

export function KomandaTicket(props: KomandaTicketProps) {
  const {
    orgName,
    identifier,
    customerLabel,
    waiterName,
    openedAtIso,
    closedAtIso,
    items,
    combos = [],
    totalCents,
    paymentMethod,
    bookingRef,
  } = props;

  const isPreview = closedAtIso === null;
  const heading = customerLabel ?? identifier;
  const bars = barcodeBars(bookingRef);

  const grouped = groupItemsByCombo({
    items: items.map((it) => ({
      id: it.id,
      combo_id: it.combo_id ?? null,
      quantity: it.quantity,
      product_name_snapshot: it.product_name_snapshot,
      variant_name_snapshot: it.variant_name_snapshot,
      variant_2_name_snapshot: it.variant_2_name_snapshot,
      unit_price_cents: it.unit_price_cents,
      modifiers: it.modifiers ?? [],
      note_text: it.note_text ?? null,
    })),
    combos: combos.map((c) => ({
      id: c.id,
      name_snapshot: c.name_snapshot,
      category_snapshot: c.category_snapshot,
      price_cents_snapshot: c.price_cents_snapshot,
    })),
  });

  return (
    <View style={styles.pad}>
      <LinearGradient
        // Brand-amber gradient — Honey Glow → Amber Flame → deep amber.
        // Mirrors StatsHeroCard so the closed-ticket reads as the same
        // brand surface as the hero revenue tile (continuity = memorable).
        colors={['#feab30', '#ff5b1f', '#7a1f00']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.card}
      >
        {/* Honey halo, smeared by the BlurView below into a soft glow. */}
        <View pointerEvents="none" style={styles.glow} />
        {Platform.OS === 'ios' ? (
          <BlurView
            tint="default"
            intensity={32}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* 1. Eyebrow */}
        <Text style={styles.eyebrow}>
          {isPreview ? 'Charge preview' : 'Order receipt'}
        </Text>

        {/* 2. Customer / org line */}
        <Text style={styles.heading} numberOfLines={2}>
          {heading}
        </Text>
        <Text style={styles.subhead} numberOfLines={1}>
          {orgName} · #{identifier}
        </Text>

        {/* 3. Time strip */}
        <View style={styles.timeStrip}>
          <View style={styles.timeCol}>
            <Text style={styles.timeLabel}>Opened</Text>
            <Text mono style={styles.timeValue}>
              {formatTime(openedAtIso)}
            </Text>
            <Text style={styles.timeMeta}>{formatDate(openedAtIso)}</Text>
          </View>
          <View style={styles.timeMid}>
            <View style={styles.timeRule} />
            <Text style={styles.timeDuration}>
              {formatDuration(openedAtIso, closedAtIso)}
            </Text>
            <View style={styles.timeRule} />
          </View>
          <View style={[styles.timeCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.timeLabel}>{isPreview ? 'Now' : 'Closed'}</Text>
            <Text mono style={styles.timeValue}>
              {closedAtIso ? formatTime(closedAtIso) : formatTime(new Date().toISOString())}
            </Text>
            <Text style={styles.timeMeta}>
              {closedAtIso ? formatDate(closedAtIso) : formatDate(new Date().toISOString())}
            </Text>
          </View>
        </View>

        {/* Perforation. RN's dashed border style is unsupported on most
            backgrounds; render the dashes as a row of tiny pills instead. */}
        <View style={styles.perfRow}>
          <View style={[styles.perfNotch, { left: -10 }]} />
          <View style={styles.perfLine}>
            {Array.from({ length: 28 }).map((_, i) => (
              <View key={i} style={styles.perfDash} />
            ))}
          </View>
          <View style={[styles.perfNotch, { right: -10 }]} />
        </View>

        {/* 4. Items list */}
        <View style={styles.items}>
          {grouped.length === 0 ? (
            <Text style={styles.itemEmpty}>No items.</Text>
          ) : (
            grouped.map((row) => {
              if (row.kind === 'combo') {
                return (
                  <ComboGroup
                    key={`c:${row.combo.id}`}
                    combo={row.combo}
                    children={row.children}
                    tone="dark"
                  />
                );
              }
              const it = row.item;
              const lineTotal = it.quantity * it.unit_price_cents;
              const mods = it.modifiers ?? [];
              return (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      <Text mono style={styles.itemQty}>
                        {it.quantity}×{' '}
                      </Text>
                      {it.product_name_snapshot}
                      {formatVariantLabel(it.variant_name_snapshot, it.variant_2_name_snapshot)
                        ? ` · ${formatVariantLabel(it.variant_name_snapshot, it.variant_2_name_snapshot)}`
                        : ''}
                    </Text>
                    {mods.length > 0 ? (
                      <Text style={styles.itemSub} numberOfLines={2}>
                        {mods.map((m) => m.name_snapshot).join(' · ')}
                      </Text>
                    ) : null}
                    {it.note_text ? (
                      <Text style={[styles.itemSub, styles.itemNote]} numberOfLines={2}>
                        “{it.note_text}”
                      </Text>
                    ) : null}
                  </View>
                  <Text mono style={styles.itemPrice}>
                    {formatMXN(lineTotal)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* 5. Booking strip (Booking / Waiter / Payment) — glass tiles
            mirror StatsHeroCard's HeroStat: BlurView absoluteFill with a
            faint white background so the tile reads as frosted glass over
            the warm gradient. */}
        <View style={styles.metaStrip}>
          <View style={styles.metaTile}>
            <BlurView
              tint="light"
              intensity={60}
              style={StyleSheet.absoluteFillObject}
              experimentalBlurMethod="dimezisBlurView"
            />
            <Text style={styles.metaLabel}>Booking</Text>
            <Text mono style={styles.metaValue} numberOfLines={1}>
              {bookingRef}
            </Text>
          </View>
          <View style={styles.metaTile}>
            <BlurView
              tint="light"
              intensity={60}
              style={StyleSheet.absoluteFillObject}
              experimentalBlurMethod="dimezisBlurView"
            />
            <Text style={styles.metaLabel}>Waiter</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {waiterName}
            </Text>
          </View>
          <View style={styles.metaTile}>
            <BlurView
              tint="light"
              intensity={60}
              style={StyleSheet.absoluteFillObject}
              experimentalBlurMethod="dimezisBlurView"
            />
            <Text style={styles.metaLabel}>Payment</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {paymentMethod ? PAYMENT_LABEL[paymentMethod] : '—'}
            </Text>
          </View>
        </View>

        {/* 6. Total row */}
        <View style={styles.totalBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text mono style={styles.totalValue}>
              {formatMXN(totalCents)}
            </Text>
          </View>
          <Text style={styles.totalCaption}>IVA incluido</Text>
        </View>

        {/* 7. Barcode */}
        <View style={styles.barcodeBand}>
          <View style={styles.barcodeRow}>
            {bars.map((b, i) => (
              <View
                key={i}
                style={{
                  width: b.width,
                  height: b.height,
                  backgroundColor: '#140D09',
                  marginRight: 1,
                }}
              />
            ))}
          </View>
          <Text mono style={styles.barcodeRef}>
            {bookingRef}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  card: {
    borderRadius: radius.xl,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 0,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    right: -120,
    top: -130,
    borderRadius: 150,
    // Bright white-honey halo blooms in the top-right corner — matches
    // StatsHeroCard so both brand surfaces share the same sunlight cue.
    backgroundColor: 'rgba(255,237,200,0.55)',
  },

  // Top of card sits over Honey Glow → bright amber. White headlines
  // wash out, so eyebrow / heading / subhead / time labels all use a
  // deep warm near-black for AAA contrast on the bright gradient stops.
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: 'rgba(42,13,0,0.78)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  heading: {
    marginTop: 4,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: fontWeight.heavy,
    color: '#1a0a02',
    letterSpacing: -0.5,
  },
  subhead: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(42,13,0,0.65)',
    letterSpacing: 0.2,
  },

  // Time strip
  timeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: space.sm,
  },
  timeCol: { gap: 2, minWidth: 64 },
  timeLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: 'rgba(42,13,0,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: '#1a0a02',
    letterSpacing: -0.2,
  },
  timeMeta: {
    fontSize: 10,
    color: 'rgba(42,13,0,0.5)',
  },
  timeMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(42,13,0,0.22)',
  },
  timeDuration: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: 'rgba(42,13,0,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Perforation between sections
  perfRow: {
    height: 14,
    marginTop: 18,
    marginHorizontal: -22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  perfNotch: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.linen,
    top: -3,
  },
  perfLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  perfDash: {
    width: 6,
    height: 1,
    backgroundColor: 'rgba(42,13,0,0.28)',
  },

  // Items
  items: {
    paddingTop: 6,
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  itemMain: { flex: 1, gap: 2 },
  itemQty: {
    color: '#3a1505',
    fontWeight: fontWeight.bold,
  },
  itemName: {
    color: '#1a0a02',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  itemSub: {
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(42,13,0,0.6)',
    marginLeft: 14,
  },
  itemNote: { fontStyle: 'italic' },
  itemPrice: {
    color: '#1a0a02',
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  itemEmpty: {
    color: 'rgba(42,13,0,0.6)',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Meta strip
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 18,
    gap: 8,
  },
  metaTile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(42,13,0,0.22)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,237,200,0.18)',
    gap: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: 'rgba(42,13,0,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: '#1a0a02',
  },

  // Total
  totalBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(42,13,0,0.18)',
    gap: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: 'rgba(42,13,0,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: {
    fontSize: 30,
    lineHeight: 40,
    includeFontPadding: false,
    fontWeight: fontWeight.heavy,
    color: '#1a0a02',
    letterSpacing: -0.4,
  },
  totalCaption: {
    fontSize: 10,
    color: 'rgba(42,13,0,0.55)',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Barcode footer band
  barcodeBand: {
    marginTop: 18,
    marginHorizontal: -22,
    paddingHorizontal: 22,
    paddingVertical: 16,
    backgroundColor: palette.bone,
    alignItems: 'center',
    gap: 6,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
  },
  barcodeRef: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
    letterSpacing: 2,
  },
});
