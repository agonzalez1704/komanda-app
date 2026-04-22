import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { CloseKomandaPayload } from '@/offline/handlers/closeKomanda';
import type { KomandaRowT } from '@/insforge/schemas';

export function useCloseKomanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseKomandaPayload) => {
      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev
          ? {
              ...prev,
              status: 'closed',
              payment_method: input.payment_method,
              total_cents: input.total_cents,
              closed_at: input.closed_at,
            }
          : prev
      );
      qc.setQueryData<KomandaRowT[]>(['komandas', 'today'], (prev) =>
        prev?.map((k) =>
          k.id === input.komanda_id
            ? {
                ...k,
                status: 'closed',
                payment_method: input.payment_method,
                total_cents: input.total_cents,
                closed_at: input.closed_at,
              }
            : k
        )
      );
      await enqueue(queueStore, { type: 'close_komanda', payload: input });
    },
  });
}
