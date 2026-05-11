import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { KomandaRowT } from '@/insforge/schemas';

export function useCancelKomanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      komanda_id: string;
      cancelled_by_auth_user_id: string;
      cancellation_note: string;
    }) => {
      const cancelled_at = new Date().toISOString();
      const note = input.cancellation_note.trim();
      if (note.length === 0) throw new Error('Cancellation note required');

      const patch = {
        status: 'cancelled' as const,
        cancelled_at,
        cancelled_by_auth_user_id: input.cancelled_by_auth_user_id,
        cancellation_note: note,
        updated_at: cancelled_at,
      };

      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev ? { ...prev, ...patch } : prev,
      );
      qc.setQueryData<KomandaRowT[]>(['komandas', 'today'], (prev) =>
        prev?.map((k) => (k.id === input.komanda_id ? { ...k, ...patch } : k)),
      );

      await enqueue(queueStore, {
        type: 'cancel_komanda',
        payload: {
          komanda_id: input.komanda_id,
          cancelled_at,
          cancelled_by_auth_user_id: input.cancelled_by_auth_user_id,
          cancellation_note: note,
        },
      });
    },
  });
}
