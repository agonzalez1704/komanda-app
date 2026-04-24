import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface DeleteModifierPayload { modifier_id: string; }

export function deleteModifierHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as DeleteModifierPayload;
    const id = await resolveId(deps.localStore, p.modifier_id);
    const { error } = await insforge.database
      .from('modifiers')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
  };
}
