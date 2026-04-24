import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { kickDrain } from '@/offline/drain';
import type { VariantRowT } from '@/insforge/schemas';

export interface DeleteVariantInput {
  variant_id: string;
  /** Optional — when provided, the per-product list is patched too so the
   * edit screen reflects the deletion immediately. */
  product_id?: string;
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | DeleteVariantInput) => {
      const variant_id = typeof input === 'string' ? input : input.variant_id;
      const product_id = typeof input === 'string' ? undefined : input.product_id;

      qc.setQueryData<VariantRowT[]>(['variants'], (prev) =>
        (prev ?? []).filter((v) => v.id !== variant_id),
      );
      qc.setQueryData<VariantRowT[]>(['variants', 'all'], (prev) =>
        (prev ?? []).map((v) => (v.id === variant_id ? { ...v, active: false } : v)),
      );
      if (product_id) {
        qc.setQueryData<VariantRowT[]>(['variants', 'forProduct', product_id], (prev) =>
          (prev ?? []).filter((v) => v.id !== variant_id),
        );
      }

      await enqueue(queueStore, {
        type: 'delete_variant',
        payload: { variant_id },
      });

      kickDrain();
    },
  });
}
