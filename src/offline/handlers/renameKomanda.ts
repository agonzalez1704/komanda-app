import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface RenameKomandaPayload {
  komanda_id: string;
  display_name: string | null;
}

export function renameKomandaHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as RenameKomandaPayload;
    const id = await resolveId(deps.localStore, payload.komanda_id);
    const { error } = await insforge.database
      .from('komandas')
      .update({ display_name: payload.display_name })
      .eq('id', id);
    if (error) throw error;
  };
}
