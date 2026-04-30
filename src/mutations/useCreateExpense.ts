import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { useSession } from '@/insforge/session';
import { uuidv4 } from '@/lib/uuid';
import type { ExpensePaidByT, ExpenseRowT } from '@/insforge/schemas';

export function useCreateExpense(orgId: string, periodId: string) {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: async (input: {
      amount_cents: number;
      category_id: string | null;
      category_other_label: string | null;
      note: string;
      paid_by: ExpensePaidByT;
    }) => {
      if (session.status !== 'signed-in') throw new Error('not_signed_in');
      const local_uuid = uuidv4();
      const optimistic: ExpenseRowT = {
        id: local_uuid,
        org_id: orgId,
        period_id: periodId,
        amount_cents: input.amount_cents,
        category_id: input.category_id,
        category_other_label: input.category_other_label,
        note: input.note,
        paid_by: input.paid_by,
        voided: false,
        voided_at: null,
        voided_by_auth_user_id: null,
        void_reason: null,
        created_at: new Date().toISOString(),
        created_by_auth_user_id: session.session.userId,
        updated_at: new Date().toISOString(),
        local_uuid,
      };

      qc.setQueryData<ExpenseRowT[]>(['expenses', periodId], (prev) => [optimistic, ...(prev ?? [])]);

      await enqueue(queueStore, {
        type: 'create_expense',
        payload: {
          org_id: orgId,
          local_uuid,
          amount_cents: input.amount_cents,
          category_id: input.category_id,
          category_other_label: input.category_other_label,
          note: input.note,
          paid_by: input.paid_by,
          created_by_auth_user_id: session.session.userId,
        },
      });

      return optimistic;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', periodId] });
    },
  });
}
