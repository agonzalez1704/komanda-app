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
    const { error } = await insforge.database
      .from('komandas')
      .update({
        status: 'closed',
        payment_method: p.payment_method,
        total_cents: p.total_cents,
        closed_at: p.closed_at,
      })
      .eq('id', id);
    if (error) throw error;
  };
}
