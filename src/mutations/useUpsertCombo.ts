import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertCombo } from '@/insforge/queries/combos';

export function useUpsertCombo(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertCombo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['combos', orgId] });
    },
  });
}
