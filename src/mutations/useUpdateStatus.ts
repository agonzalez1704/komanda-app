import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { KomandaRowT, KomandaStatusT } from '@/insforge/schemas';

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { komanda_id: string; status: KomandaStatusT }) => {
      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev ? { ...prev, status: input.status } : prev
      );
      qc.setQueryData<KomandaRowT[]>(['komandas', 'today'], (prev) =>
        prev?.map((k) => (k.id === input.komanda_id ? { ...k, status: input.status } : k))
      );
      await enqueue(queueStore, { type: 'update_status', payload: input });
    },
  });
}
