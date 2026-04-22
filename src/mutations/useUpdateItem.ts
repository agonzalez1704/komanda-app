import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { UpdateItemPayload } from '@/offline/handlers/updateItem';

export function useUpdateItem(komandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateItemPayload) => {
      await enqueue(queueStore, { type: 'update_item', payload: input });
      await qc.invalidateQueries({ queryKey: ['komanda', komandaId, 'items'] });
    },
  });
}
