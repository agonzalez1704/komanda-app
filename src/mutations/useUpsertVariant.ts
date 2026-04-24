import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { kickDrain } from '@/offline/drain';
import type { VariantRowT } from '@/insforge/schemas';
import { uuidv4 } from '@/lib/uuid';

export interface UpsertVariantInput {
  id?: string;
  product_id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export function useUpsertVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertVariantInput) => {
      const is_new = !input.id;
      const variant_id = input.id ?? uuidv4();

      const optimistic: VariantRowT = {
        id: variant_id,
        product_id: input.product_id,
        org_id: '00000000-0000-0000-0000-000000000000',
        name: input.name,
        active: input.active,
        sort_order: input.sort_order,
      };

      const patch = (prev: VariantRowT[] | undefined) => {
        const list = prev ?? [];
        const idx = list.findIndex((v) => v.id === variant_id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = { ...next[idx], ...optimistic };
          return next;
        }
        return [...list, optimistic];
      };
      qc.setQueryData<VariantRowT[]>(['variants', 'all'], patch);
      qc.setQueryData<VariantRowT[]>(['variants', 'forProduct', input.product_id], patch);
      if (input.active) {
        qc.setQueryData<VariantRowT[]>(['variants'], patch);
      } else {
        qc.setQueryData<VariantRowT[]>(['variants'], (prev) =>
          (prev ?? []).filter((v) => v.id !== variant_id),
        );
      }

      await enqueue(queueStore, {
        type: 'upsert_variant',
        payload: {
          variant_id,
          is_new,
          product_id: input.product_id,
          name: input.name,
          active: input.active,
          sort_order: input.sort_order,
        },
      });

      // Nudge the offline processor so the server sync (and the follow-up
      // cache invalidation inside drain.ts) happens right away — otherwise
      // the optimistic row sits as a temp-uuid until the next 5s tick.
      kickDrain();

      return optimistic;
    },
  });
}
