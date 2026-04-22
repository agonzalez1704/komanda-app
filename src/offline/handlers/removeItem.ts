import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface RemoveItemPayload { item_id: string; }

export function removeItemHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as RemoveItemPayload;
    const id = await resolveId(deps.localStore, p.item_id);
    const { error } = await insforge.database.from('komanda_items').delete().eq('id', id);
    if (error) throw error;
  };
}
