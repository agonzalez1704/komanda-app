import { useCallback } from 'react';
import { shareReceipt } from '@/receipt/shareReceipt';
import { displayIdentifier } from '@/domain/komandaNumber';
import type { KomandaRowT } from '@/insforge/schemas';
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
  membership,
}: {
  row: KomandaRowT | null;
  items: KomandaItemWithMods[];
  membership: Membership;
}) {
  return useCallback(async () => {
    if (!row || !membership || row.payment_method === null) return;
    await shareReceipt({
      orgName: membership.organization.name,
      identifier: displayIdentifier(row),
      customerLabel: row.display_name,
      waiterName: membership.display_name,
      openedAtIso: row.opened_at,
      closedAtIso: row.closed_at,
      items: items.map((it) => ({
        quantity: it.quantity,
        product_name_snapshot: it.product_name_snapshot,
        variant_name_snapshot: it.variant_name_snapshot,
        unit_price_cents: it.unit_price_cents,
        modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
        note_text: it.note_text,
      })),
      totalCents: row.total_cents ?? 0,
      paymentMethod: row.payment_method,
      bookingRef: row.id.split('-')[0].toUpperCase(),
    });
  }, [row, items, membership]);
}
