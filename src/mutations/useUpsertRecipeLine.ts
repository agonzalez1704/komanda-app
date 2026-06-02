import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteRecipeLine,
  upsertRecipeLine,
} from '@/insforge/queries/margins';

export function useUpsertRecipeLine(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      productId: string;
      ingredientId: string;
      quantity: number;
    }) => upsertRecipeLine({ ...input, orgId }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['recipe-lines', vars.productId] });
      qc.invalidateQueries({ queryKey: ['recipe-lines', 'all', orgId] });
    },
  });
}

export function useDeleteRecipeLine(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; productId: string }) =>
      deleteRecipeLine(input.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['recipe-lines', vars.productId] });
      qc.invalidateQueries({ queryKey: ['recipe-lines', 'all', orgId] });
    },
  });
}
