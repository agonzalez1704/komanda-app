import { useMutation, useQueryClient } from '@tanstack/react-query';
import 'react-native-get-random-values';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { AddItemPayload } from '@/offline/handlers/addItem';

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<AddItemPayload, 'item_local_uuid'>) => {
      const item_local_uuid = (globalThis.crypto as any).randomUUID();
      await enqueue(queueStore, {
        type: 'add_item',
        payload: { ...input, item_local_uuid },
      });
      await qc.invalidateQueries({ queryKey: ['komanda', input.komanda_id, 'items'] });
      return item_local_uuid;
    },
  });
}
