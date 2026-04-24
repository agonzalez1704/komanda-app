import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { rememberSync, resolveId, type LocalStore } from '@/offline/localStore';

export interface UpsertModifierPayload {
  modifier_id: string;
  is_new: boolean;
  name: string;
  active: boolean;
}

export function upsertModifierHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as UpsertModifierPayload;

    if (p.is_new) {
      const { data, error } = await insforge.database
        .from('modifiers')
        .insert({
          id: p.modifier_id,
          name: p.name,
          active: p.active,
        })
        .select('*')
        .single();
      if (error) throw error;
      await rememberSync(deps.localStore, p.modifier_id, data.id);
      return;
    }

    const id = await resolveId(deps.localStore, p.modifier_id);
    const { error } = await insforge.database
      .from('modifiers')
      .update({ name: p.name, active: p.active })
      .eq('id', id);
    if (error) throw error;
  };
}
