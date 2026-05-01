import { insforge } from '@/insforge/client';
import type { QueuedMutation, QueueStore } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import { DeferredMutationError, getQueuedProducerIds } from './_deps';

export interface UpdateItemPayload {
  item_id: string;
  quantity?: number;
  note_text?: string | null;
}

export function updateItemHandler(deps: { localStore: LocalStore; queueStore: QueueStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as UpdateItemPayload;
    const id = await resolveId(deps.localStore, p.item_id);
    if (id === p.item_id) {
      const producers = await getQueuedProducerIds(deps.queueStore);
      if (producers.has(p.item_id)) {
        throw new DeferredMutationError(
          `update_item: waiting on parent item ${p.item_id} to sync`,
        );
      }
    }
    const patch: Record<string, unknown> = {};
    if (p.quantity !== undefined) patch.quantity = p.quantity;
    if (p.note_text !== undefined) patch.note_text = p.note_text;
    if (Object.keys(patch).length === 0) return;
    const { error } = await insforge.database.from('komanda_items').update(patch).eq('id', id);
    if (error) throw error;
  };
}
