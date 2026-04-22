import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { KomandaRowT } from '@/insforge/schemas';

export function useRenameKomanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { komanda_id: string; display_name: string | null }) => {
      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev ? { ...prev, display_name: input.display_name } : prev
      );
      await enqueue(queueStore, { type: 'rename_komanda', payload: input });
    },
  });
}
