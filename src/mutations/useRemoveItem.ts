import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';

export function useRemoveItem(komandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item_id: string) => {
      await enqueue(queueStore, { type: 'remove_item', payload: { item_id } });
      await qc.invalidateQueries({ queryKey: ['komanda', komandaId, 'items'] });
    },
  });
}
