import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface UpdateItemPayload {
  item_id: string;
  quantity?: number;
  note_text?: string | null;
}

export function updateItemHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as UpdateItemPayload;
    const id = await resolveId(deps.localStore, p.item_id);
    const patch: Record<string, unknown> = {};
    if (p.quantity !== undefined) patch.quantity = p.quantity;
    if (p.note_text !== undefined) patch.note_text = p.note_text;
    if (Object.keys(patch).length === 0) return;
    const { error } = await insforge.database.from('komanda_items').update(patch).eq('id', id);
    if (error) throw error;
  };
}
