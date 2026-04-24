import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import type { KomandaStatusT } from '@/insforge/schemas';

export interface UpdateStatusPayload {
  komanda_id: string;
  status: KomandaStatusT;
}

export function updateStatusHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as UpdateStatusPayload;
    const id = await resolveId(deps.localStore, payload.komanda_id);
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
