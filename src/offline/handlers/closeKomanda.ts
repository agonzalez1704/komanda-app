import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import type { PaymentMethodT } from '@/insforge/schemas';

export interface CloseKomandaPayload {
  komanda_id: string;
  payment_method: PaymentMethodT;
  total_cents: number;
  closed_at: string;
}

export function closeKomandaHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as CloseKomandaPayload;
    const id = await resolveId(deps.localStore, p.komanda_id);
    // `.select()` forces PostgREST to return the updated rows. Without it,
    // an UPDATE that matches 0 rows (because the server id mapping isn't in
    // place yet, or RLS hid the row) returns `error: null` and the handler
    // would dequeue silently — leaving the UI "closed" but the DB untouched.
    const { data, error } = await insforge.database
      .from('komandas')
      .update({
        status: 'closed',
        payment_method: p.payment_method,
        total_cents: p.total_cents,
        closed_at: p.closed_at,
      })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(
        `close_komanda: no row matched id=${id} (likely sync mapping missing or RLS blocked)`,
      );
    }
  };
}
