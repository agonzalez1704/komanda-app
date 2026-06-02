import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setProductUberPrice } from '@/insforge/queries/margins';

/**
 * Admin-only mutation to set/clear a product's Uber Eats price override.
 *
 * NOTE: deliberately bypasses the offline queue and the `upsert_product`
 * handler — admin-only screens don't need offline parity in v1, and adding
 * this field to the existing handler would muddy the cashier write path.
 * Pattern matches useInviteMember / useChangeMemberRole.
 */
export function useSetUberPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      productId: string;
      uberPriceCents: number | null;
    }) => setProductUberPrice(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products', 'all'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}
