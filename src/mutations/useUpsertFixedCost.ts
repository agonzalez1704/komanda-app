import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteFixedCost, upsertFixedCost } from '@/insforge/queries/margins';

export function useUpsertFixedCost(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      label: string;
      dailyCents: number;
      notes?: string | null;
      active?: boolean;
      sortOrder?: number;
    }) => upsertFixedCost({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs', orgId] });
    },
  });
}

export function useDeleteFixedCost(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFixedCost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs', orgId] });
    },
  });
}
