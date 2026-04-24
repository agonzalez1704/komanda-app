import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type {
  KomandaItemRowT,
  KomandaItemModifierRowT,
} from '@/insforge/queries/komandas';

type ItemWithMods = KomandaItemRowT & { modifiers: KomandaItemModifierRowT[] };

export function useRemoveItem(komandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item_id: string) => {
      qc.setQueryData<ItemWithMods[]>(
        ['komanda', komandaId, 'items'],
        (prev) => (prev ?? []).filter((it) => it.id !== item_id)
      );
      await enqueue(queueStore, { type: 'remove_item', payload: { item_id } });
    },
  });
}
