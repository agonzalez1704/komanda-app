import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { ProductRowT } from '@/insforge/schemas';
import { uuidv4 } from '@/lib/uuid';

export interface UpsertProductInput {
  /** Omit for new products — a fresh uuid will be minted. */
  id?: string;
  name: string;
  category: string;
  price_cents: number;
  active: boolean;
  sort_order: number;
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertProductInput) => {
      const is_new = !input.id;
      const product_id = input.id ?? uuidv4();

      const optimistic: ProductRowT = {
        id: product_id,
        org_id: '00000000-0000-0000-0000-000000000000',
        name: input.name,
        category: input.category,
        price_cents: input.price_cents,
        active: input.active,
        sort_order: input.sort_order,
        created_at: new Date().toISOString(),
      };

      // Optimistically update both the management and active-menu caches.
      const patch = (prev: ProductRowT[] | undefined) => {
        const list = prev ?? [];
        const idx = list.findIndex((p) => p.id === product_id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = { ...next[idx], ...optimistic };
          return next;
        }
        return [...list, optimistic];
      };
      qc.setQueryData<ProductRowT[]>(['products', 'all'], patch);
      if (input.active) {
        qc.setQueryData<ProductRowT[]>(['products'], patch);
      } else {
        qc.setQueryData<ProductRowT[]>(['products'], (prev) =>
          (prev ?? []).filter((p) => p.id !== product_id),
        );
      }
      qc.setQueryData<ProductRowT>(['product', product_id], optimistic);

      await enqueue(queueStore, {
        type: 'upsert_product',
        payload: {
          product_id,
          is_new,
          name: input.name,
          category: input.category,
          price_cents: input.price_cents,
          active: input.active,
          sort_order: input.sort_order,
        },
      });

      return optimistic;
    },
  });
}
