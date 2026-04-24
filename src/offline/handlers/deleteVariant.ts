import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface DeleteVariantPayload { variant_id: string; }

export function deleteVariantHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as DeleteVariantPayload;
    const id = await resolveId(deps.localStore, p.variant_id);
    const { error } = await insforge.database
      .from('variants')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
  };
}
