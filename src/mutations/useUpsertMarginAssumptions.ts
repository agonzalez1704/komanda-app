import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertMarginAssumptions } from '@/insforge/queries/margins';

export function useUpsertMarginAssumptions(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      uberCommissionPct: number;
      uberIvaRetentionPct: number;
      markupA: number;
      markupB: number;
    }) => upsertMarginAssumptions({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['margin-assumptions', orgId] });
    },
  });
}
