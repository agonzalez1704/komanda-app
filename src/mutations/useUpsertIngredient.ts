import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertIngredient } from '@/insforge/queries/margins';
import type { IngredientUnitT } from '@/insforge/schemas';

export function useUpsertIngredient(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      name: string;
      unit: IngredientUnitT;
      costCentsPerUnit: number;
      active?: boolean;
    }) => upsertIngredient({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients', orgId] });
    },
  });
}
