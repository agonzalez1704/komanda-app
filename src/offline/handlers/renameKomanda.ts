import { insforge } from '@/insforge/client';
import type { QueuedMutation, QueueStore } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import { DeferredMutationError, getQueuedProducerIds } from './_deps';

export interface RenameKomandaPayload {
  komanda_id: string;
  display_name: string | null;
}

export function renameKomandaHandler(deps: { localStore: LocalStore; queueStore: QueueStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as RenameKomandaPayload;
    const id = await resolveId(deps.localStore, payload.komanda_id);
    if (id === payload.komanda_id) {
      const producers = await getQueuedProducerIds(deps.queueStore);
      if (producers.has(payload.komanda_id)) {
        throw new DeferredMutationError(
          `rename_komanda: waiting on parent komanda ${payload.komanda_id} to sync`,
        );
      }
    }
    const { data, error } = await insforge.database
      .from('komandas')
      .update({ display_name: payload.display_name })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(`rename_komanda: no row matched id=${id}`);
    }
  };
}
