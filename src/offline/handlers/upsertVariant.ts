import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { rememberSync, resolveId, type LocalStore } from '@/offline/localStore';

export interface UpsertVariantPayload {
  variant_id: string;
  is_new: boolean;
  product_id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export function upsertVariantHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as UpsertVariantPayload;
    const productId = await resolveId(deps.localStore, p.product_id);

    if (p.is_new) {
      const { data, error } = await insforge.database
        .from('variants')
        .insert({
          id: p.variant_id,
          product_id: productId,
          name: p.name,
          active: p.active,
          sort_order: p.sort_order,
        })
        .select('*')
        .single();
      if (error) throw error;
      await rememberSync(deps.localStore, p.variant_id, data.id);
      return;
    }

    const id = await resolveId(deps.localStore, p.variant_id);
    const { error } = await insforge.database
      .from('variants')
      .update({
        product_id: productId,
        name: p.name,
        active: p.active,
        sort_order: p.sort_order,
      })
      .eq('id', id);
    if (error) throw error;
  };
}
