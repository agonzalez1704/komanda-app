import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { AddItemPayload } from '@/offline/handlers/addItem';
import type {
  KomandaItemRowT,
  KomandaItemModifierRowT,
} from '@/insforge/queries/komandas';
import { uuidv4 } from '@/lib/uuid';

type ItemWithMods = KomandaItemRowT & { modifiers: KomandaItemModifierRowT[] };

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<AddItemPayload, 'item_local_uuid'>) => {
      const item_local_uuid = uuidv4();

      const optimistic: ItemWithMods = {
        id: item_local_uuid,
        komanda_id: input.komanda_id,
        org_id: '00000000-0000-0000-0000-000000000000',
        product_id: input.product_id,
        variant_id: input.variant_id,
        quantity: input.quantity,
        unit_price_cents: input.unit_price_cents,
        product_name_snapshot: input.product_name_snapshot,
        variant_name_snapshot: input.variant_name_snapshot,
        note_text: input.note_text,
        created_at: new Date().toISOString(),
        modifiers: input.modifiers.map((m, idx) => ({
          id: `${item_local_uuid}-m${idx}`,
          komanda_item_id: item_local_uuid,
          modifier_id: m.modifier_id,
          name_snapshot: m.name_snapshot,
        })),
      };

      qc.setQueryData<ItemWithMods[]>(
        ['komanda', input.komanda_id, 'items'],
        (prev) => [...(prev ?? []), optimistic]
      );

      await enqueue(queueStore, {
        type: 'add_item',
        payload: { ...input, item_local_uuid },
      });

      return item_local_uuid;
    },
  });
}
