import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { rememberSync, resolveId, type LocalStore } from '@/offline/localStore';

export interface UpsertProductPayload {
  /**
   * Stable client-side id. For new products this is a freshly-minted UUID that
   * the server will keep. For edits it's the existing server id (or a local id
   * that the localStore will resolve).
   */
  product_id: string;
  /** `true` when the row should be created, `false` when it's an update. */
  is_new: boolean;
  name: string;
  category: string;
  price_cents: number;
  active: boolean;
  sort_order: number;
}

export function upsertProductHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as UpsertProductPayload;

    if (p.is_new) {
      const { data, error } = await insforge.database
        .from('products')
        .insert({
          id: p.product_id,
          name: p.name,
          category: p.category,
          price_cents: p.price_cents,
          active: p.active,
          sort_order: p.sort_order,
        })
        .select('*')
        .single();
      if (error) throw error;
      await rememberSync(deps.localStore, p.product_id, data.id);
      return;
    }

    const id = await resolveId(deps.localStore, p.product_id);
    const { error } = await insforge.database
      .from('products')
      .update({
        name: p.name,
        category: p.category,
        price_cents: p.price_cents,
        active: p.active,
        sort_order: p.sort_order,
      })
      .eq('id', id);
    if (error) throw error;
  };
}
