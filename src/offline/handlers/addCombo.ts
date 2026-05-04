import { rememberSync, resolveId, type LocalStore } from '@/offline/localStore';
import { addKomandaCombo } from '@/insforge/queries/komandaCombos';
import type { QueuedMutation, QueueStore } from '@/offline/queue';
import { DeferredMutationError, getQueuedProducerIds } from './_deps';

export interface AddComboPayload {
  combo_local_uuid: string;
  /** local-uuid or server uuid; resolved at run-time */
  komanda_id: string;
  combo_id: string | null;
  name_snapshot: string;
  category_snapshot: string;
  price_cents_snapshot: number;
  children: Array<{
    item_local_uuid: string;
    product_id: string | null;
    variant_id: string | null;
    quantity: number;
    product_name_snapshot: string;
    variant_name_snapshot: string | null;
    note_text: string | null;
    modifiers: Array<{ modifier_id: string | null; name_snapshot: string }>;
  }>;
}

export function addComboHandler(deps: {
  localStore: LocalStore;
  queueStore: QueueStore;
}) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as AddComboPayload;
    const komandaId = await resolveId(deps.localStore, p.komanda_id);
    if (komandaId === p.komanda_id) {
      const producers = await getQueuedProducerIds(deps.queueStore);
      if (producers.has(p.komanda_id)) {
        throw new DeferredMutationError(
          `add_combo: waiting on parent komanda ${p.komanda_id} to sync`,
        );
      }
    }
    const inserted = await addKomandaCombo({
      komanda_id: komandaId,
      combo_id: p.combo_id,
      local_uuid: p.combo_local_uuid,
      name_snapshot: p.name_snapshot,
      category_snapshot: p.category_snapshot,
      price_cents_snapshot: p.price_cents_snapshot,
      children: p.children,
    });
    // Remember combo mapping so subsequent mutations (remove_combo) resolve.
    // Server ids for child items aren't returned by the RPC; offline mutations
    // on individual child items aren't supported (atomic remove only).
    await rememberSync(deps.localStore, p.combo_local_uuid, inserted.id);
  };
}
