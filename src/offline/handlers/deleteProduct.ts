import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface DeleteProductPayload { product_id: string; }

/**
 * Soft-delete: flip `active` to false so historical komanda items keep their
 * `product_name_snapshot` intact and no dangling FK references break.
 */
export function deleteProductHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as DeleteProductPayload;
    const id = await resolveId(deps.localStore, p.product_id);
    const { error } = await insforge.database
      .from('products')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;

    // Also deactivate any child variants so they drop out of the add-item flow.
    const { error: vErr } = await insforge.database
      .from('variants')
      .update({ active: false })
      .eq('product_id', id);
    if (vErr) throw vErr;
  };
}
