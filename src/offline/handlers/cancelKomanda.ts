import { insforge } from '@/insforge/client';
import type { QueuedMutation, QueueStore } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import { DeferredMutationError, getQueuedProducerIds } from './_deps';

export interface CancelKomandaPayload {
  komanda_id: string;
  cancelled_at: string;
  cancelled_by_auth_user_id: string;
  cancellation_note: string;
}

export function cancelKomandaHandler(deps: {
  localStore: LocalStore;
  queueStore: QueueStore;
}) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as CancelKomandaPayload;
    const id = await resolveId(deps.localStore, p.komanda_id);
    if (id === p.komanda_id) {
      const producers = await getQueuedProducerIds(deps.queueStore);
      if (producers.has(p.komanda_id)) {
        throw new DeferredMutationError(
          `cancel_komanda: waiting on parent komanda ${p.komanda_id} to sync`,
        );
      }
    }
    const { data, error } = await insforge.database
      .from('komandas')
      .update({
        status: 'cancelled',
        cancelled_at: p.cancelled_at,
        cancelled_by_auth_user_id: p.cancelled_by_auth_user_id,
        cancellation_note: p.cancellation_note,
      })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(
        `cancel_komanda: no row matched id=${id} (sync mapping missing or RLS blocked)`,
      );
    }
  };
}
