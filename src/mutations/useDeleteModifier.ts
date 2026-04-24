import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { ModifierRowT } from '@/insforge/schemas';

export function useDeleteModifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modifier_id: string) => {
      qc.setQueryData<ModifierRowT[]>(['modifiers'], (prev) =>
        (prev ?? []).filter((m) => m.id !== modifier_id),
      );
      qc.setQueryData<ModifierRowT[]>(['modifiers', 'all'], (prev) =>
        (prev ?? []).map((m) => (m.id === modifier_id ? { ...m, active: false } : m)),
      );
      await enqueue(queueStore, {
        type: 'delete_modifier',
        payload: { modifier_id },
      });
    },
  });
}
