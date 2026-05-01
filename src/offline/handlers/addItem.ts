import { insforge } from '@/insforge/client';
import type { QueuedMutation, QueueStore } from '@/offline/queue';
import { rememberSync, resolveId, type LocalStore } from '@/offline/localStore';
import { DeferredMutationError, getQueuedProducerIds } from './_deps';

export interface AddItemPayload {
  item_local_uuid: string;
  komanda_id: string;
  /** null for ad-hoc/custom items that aren't in the menu. */
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price_cents: number;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  note_text: string | null;
  modifiers: Array<{ modifier_id: string | null; name_snapshot: string }>;
}

export function addItemHandler(deps: { localStore: LocalStore; queueStore: QueueStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as AddItemPayload;
    const komandaId = await resolveId(deps.localStore, p.komanda_id);
    if (komandaId === p.komanda_id) {
      const producers = await getQueuedProducerIds(deps.queueStore);
      if (producers.has(p.komanda_id)) {
        throw new DeferredMutationError(
          `add_item: waiting on parent komanda ${p.komanda_id} to sync`,
        );
      }
    }

    const { data: inserted, error } = await insforge.database
      .from('komanda_items')
      .insert({
        komanda_id: komandaId,
        product_id: p.product_id,
        variant_id: p.variant_id,
        quantity: p.quantity,
        unit_price_cents: p.unit_price_cents,
        product_name_snapshot: p.product_name_snapshot,
        variant_name_snapshot: p.variant_name_snapshot,
        note_text: p.note_text,
      })
      .select('*')
      .single();
    if (error) throw error;

    await rememberSync(deps.localStore, p.item_local_uuid, inserted.id);

    if (p.modifiers.length > 0) {
      const { error: modErr } = await insforge.database
        .from('komanda_item_modifiers')
        .insert(
          p.modifiers.map((mod) => ({
            komanda_item_id: inserted.id,
            modifier_id: mod.modifier_id,
            name_snapshot: mod.name_snapshot,
          }))
        );
      if (modErr) throw modErr;
    }
  };
}
