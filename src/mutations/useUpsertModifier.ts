import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { ModifierRowT } from '@/insforge/schemas';
import { uuidv4 } from '@/lib/uuid';

export interface UpsertModifierInput {
  id?: string;
  name: string;
  active: boolean;
}

export function useUpsertModifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertModifierInput) => {
      const is_new = !input.id;
      const modifier_id = input.id ?? uuidv4();

      const optimistic: ModifierRowT = {
        id: modifier_id,
        org_id: '00000000-0000-0000-0000-000000000000',
        name: input.name,
        active: input.active,
      };

      const patch = (prev: ModifierRowT[] | undefined) => {
        const list = prev ?? [];
        const idx = list.findIndex((m) => m.id === modifier_id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = { ...next[idx], ...optimistic };
          return next;
        }
        return [...list, optimistic];
      };
      qc.setQueryData<ModifierRowT[]>(['modifiers', 'all'], patch);
      if (input.active) {
        qc.setQueryData<ModifierRowT[]>(['modifiers'], patch);
      } else {
        qc.setQueryData<ModifierRowT[]>(['modifiers'], (prev) =>
          (prev ?? []).filter((m) => m.id !== modifier_id),
        );
      }

      await enqueue(queueStore, {
        type: 'upsert_modifier',
        payload: {
          modifier_id,
          is_new,
          name: input.name,
          active: input.active,
        },
      });

      return optimistic;
    },
  });
}
