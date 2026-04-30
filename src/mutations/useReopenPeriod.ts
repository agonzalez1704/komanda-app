import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reopenPeriod } from '@/insforge/queries/auditPeriods';

export function useReopenPeriod(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { periodId: string; reason: string }) =>
      reopenPeriod(input.periodId, input.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-period', orgId] });
      qc.invalidateQueries({ queryKey: ['audit-history', orgId] });
    },
  });
}
