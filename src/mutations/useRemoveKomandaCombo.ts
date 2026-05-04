import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { KomandaComboRowT } from '@/insforge/schemas';

export function useRemoveKomandaCombo(komandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { combo_id: string }) => {
      qc.setQueryData<KomandaComboRowT[]>(
        ['komanda', komandaId, 'combos'],
        (prev) => (prev ?? []).filter((c) => c.id !== input.combo_id),
      );
      qc.setQueryData<any[]>(['komanda', komandaId, 'items'], (prev) =>
        (prev ?? []).filter((it: any) => it.combo_id !== input.combo_id),
      );
      await enqueue(queueStore, {
        type: 'remove_combo',
        payload: { combo_id: input.combo_id },
      });
    },
  });
}
