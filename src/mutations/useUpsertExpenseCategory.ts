import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertExpenseCategory } from '@/insforge/queries/expenseCategories';

export function useUpsertExpenseCategory(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; name: string; active?: boolean; sort_order?: number }) =>
      upsertExpenseCategory({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-categories', orgId] });
    },
  });
}
