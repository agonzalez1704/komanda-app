import { insforge } from '@/insforge/client';
import type { QueuedMutation, QueueStore } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import { DeferredMutationError, getQueuedProducerIds } from './_deps';

export interface RemoveItemPayload { item_id: string; }

export function removeItemHandler(deps: { localStore: LocalStore; queueStore: QueueStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as RemoveItemPayload;
    const id = await resolveId(deps.localStore, p.item_id);
    if (id === p.item_id) {
      const producers = await getQueuedProducerIds(deps.queueStore);
      if (producers.has(p.item_id)) {
        throw new DeferredMutationError(
          `remove_item: waiting on parent item ${p.item_id} to sync`,
        );
      }
    }
    const { error } = await insforge.database.from('komanda_items').delete().eq('id', id);
    if (error) throw error;
  };
}
