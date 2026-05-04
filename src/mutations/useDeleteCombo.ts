import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCombo } from '@/insforge/queries/combos';

export function useDeleteCombo(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCombo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['combos', orgId] });
    },
  });
}
