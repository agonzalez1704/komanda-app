import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { uuidv4 } from '@/lib/uuid';
import type {
  ComboItemRowT,
  ComboRowT,
  KomandaComboRowT,
} from '@/insforge/schemas';

export interface AddComboInput {
  /** local-uuid or server uuid; offline-aware via queue resolution */
  komanda_id: string;
  combo: ComboRowT;
  composition: ComboItemRowT[];
  childOverrides?: Record<
    string,
    {
      note_text?: string | null;
      modifiers?: Array<{ modifier_id: string | null; name_snapshot: string }>;
    }
  >;
  productNameById: Record<string, string>;
  variantNameById: Record<string, string | null>;
}

export function useAddKomandaCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddComboInput) => {
      const combo_local_uuid = uuidv4();
      const children = input.composition.map((ci) => ({
        item_local_uuid: uuidv4(),
        product_id: ci.product_id,
        variant_id: ci.variant_id ?? null,
        quantity: ci.quantity,
        product_name_snapshot: input.productNameById[ci.product_id] ?? 'Unknown',
        variant_name_snapshot: ci.variant_id
          ? input.variantNameById[ci.variant_id] ?? null
          : null,
        note_text: input.childOverrides?.[ci.id]?.note_text ?? null,
        modifiers: input.childOverrides?.[ci.id]?.modifiers ?? [],
      }));

      const optimistic: KomandaComboRowT = {
        id: combo_local_uuid,
        komanda_id: input.komanda_id,
        org_id: input.combo.org_id,
        combo_id: input.combo.id,
        name_snapshot: input.combo.name,
        category_snapshot: input.combo.category,
        price_cents_snapshot: input.combo.price_cents,
        created_at: new Date().toISOString(),
        local_uuid: combo_local_uuid,
      };

      qc.setQueryData<KomandaComboRowT[]>(
        ['komanda', input.komanda_id, 'combos'],
        (prev) => [...(prev ?? []), optimistic],
      );
      qc.setQueryData<any[]>(['komanda', input.komanda_id, 'items'], (prev) => [
        ...(prev ?? []),
        ...children.map((c) => ({
          id: c.item_local_uuid,
          combo_id: combo_local_uuid,
          quantity: c.quantity,
          product_name_snapshot: c.product_name_snapshot,
          variant_name_snapshot: c.variant_name_snapshot,
          unit_price_cents: 0,
          modifiers: c.modifiers,
          note_text: c.note_text,
        })),
      ]);

      await enqueue(queueStore, {
        type: 'add_combo',
        payload: {
          combo_local_uuid,
          komanda_id: input.komanda_id,
          combo_id: input.combo.id,
          name_snapshot: input.combo.name,
          category_snapshot: input.combo.category,
          price_cents_snapshot: input.combo.price_cents,
          children,
        },
      });
      return optimistic;
    },
  });
}
