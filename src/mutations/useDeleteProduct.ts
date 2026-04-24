import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { ProductRowT, VariantRowT } from '@/insforge/schemas';

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product_id: string) => {
      // Optimistically pull from the active list …
      qc.setQueryData<ProductRowT[]>(['products'], (prev) =>
        (prev ?? []).filter((p) => p.id !== product_id),
      );
      // … and mark inactive in the full management list.
      qc.setQueryData<ProductRowT[]>(['products', 'all'], (prev) =>
        (prev ?? []).map((p) => (p.id === product_id ? { ...p, active: false } : p)),
      );
      // Cascade to variants cache.
      qc.setQueryData<VariantRowT[]>(['variants'], (prev) =>
        (prev ?? []).filter((v) => v.product_id !== product_id),
      );
      qc.setQueryData<VariantRowT[]>(['variants', 'all'], (prev) =>
        (prev ?? []).map((v) => (v.product_id === product_id ? { ...v, active: false } : v)),
      );

      await enqueue(queueStore, {
        type: 'delete_product',
        payload: { product_id },
      });
    },
  });
}
