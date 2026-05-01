import { useMutation, useQueryClient } from '@tanstack/react-query';
import { voidExpense } from '@/insforge/queries/expenses';
import { useSession } from '@/insforge/session';

export function useVoidExpense(periodId: string) {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) => {
      if (session.status !== 'signed-in') throw new Error('not_signed_in');
      return voidExpense(input.id, input.reason, session.session.userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', periodId] });
      qc.invalidateQueries({ queryKey: ['audit', periodId] });
    },
  });
}
