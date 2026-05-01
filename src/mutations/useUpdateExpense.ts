import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateExpense } from '@/insforge/queries/expenses';
import type { ExpensePaidByT } from '@/insforge/schemas';

export function useUpdateExpense(periodId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: Partial<{
        amount_cents: number;
        category_id: string | null;
        category_other_label: string | null;
        note: string;
        paid_by: ExpensePaidByT;
      }>;
    }) => updateExpense(input.id, input.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', periodId] });
      qc.invalidateQueries({ queryKey: ['audit', periodId] });
    },
  });
}
