import { insforge } from '@/insforge/client';
import type { QueuedMutation, QueueStore } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import type { KomandaStatusT } from '@/insforge/schemas';
import { DeferredMutationError, getQueuedProducerIds } from './_deps';

export interface UpdateStatusPayload {
  komanda_id: string;
  status: KomandaStatusT;
}

export function updateStatusHandler(deps: { localStore: LocalStore; queueStore: QueueStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as UpdateStatusPayload;
    const id = await resolveId(deps.localStore, payload.komanda_id);
    if (id === payload.komanda_id) {
      const producers = await getQueuedProducerIds(deps.queueStore);
      if (producers.has(payload.komanda_id)) {
        throw new DeferredMutationError(
          `update_status: waiting on parent komanda ${payload.komanda_id} to sync`,
        );
      }
    }
    const { data, error } = await insforge.database
      .from('komandas')
      .update({ status: payload.status })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(`update_status: no row matched id=${id}`);
    }
  };
}
