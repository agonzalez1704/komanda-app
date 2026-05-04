import { useCallback } from 'react';
import { shareReceipt } from '@/receipt/shareReceipt';
import { displayIdentifier } from '@/domain/komandaNumber';
import type { KomandaComboRowT, KomandaRowT } from '@/insforge/schemas';
import type { KomandaItemWithMods } from './useKomandaDetail';

type Membership = {
  organization: { name: string };
  display_name: string;
} | null | undefined;

/**
 * Returns a stable callback that reshares the receipt for a closed
 * komanda. No-ops silently when row, membership, or payment method are
 * missing — the caller renders the share button unconditionally and we
 * guard here instead of duplicating the guard at every call site.
 */
export function useReshareReceipt({
  row,
  items,
  combos,
  membership,
}: {
  row: KomandaRowT | null;
  items: KomandaItemWithMods[];
  combos: KomandaComboRowT[];
  membership: Membership;
}) {
  return useCallback(async () => {
    if (!row || !membership || row.payment_method === null) return;
    const childByCombo = new Map<string, KomandaItemWithMods[]>();
    for (const it of items) {
      if (it.combo_id) {
        const arr = childByCombo.get(it.combo_id) ?? [];
        arr.push(it);
        childByCombo.set(it.combo_id, arr);
      }
    }
    await shareReceipt({
      orgName: membership.organization.name,
      identifier: displayIdentifier(row),
      customerLabel: row.display_name,
      waiterName: membership.display_name,
      openedAtIso: row.opened_at,
      closedAtIso: row.closed_at,
      items: items
        .filter((it) => it.combo_id == null)
        .map((it) => ({
          quantity: it.quantity,
          product_name_snapshot: it.product_name_snapshot,
          variant_name_snapshot: it.variant_name_snapshot,
          unit_price_cents: it.unit_price_cents,
          modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
          note_text: it.note_text,
        })),
      combos: combos.map((c) => ({
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
      totalCents: row.total_cents ?? 0,
      paymentMethod: row.payment_method,
      bookingRef: row.id.split('-')[0].toUpperCase(),
    });
  }, [row, items, combos, membership]);
}
