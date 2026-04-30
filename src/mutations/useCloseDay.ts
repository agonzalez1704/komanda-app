import { useMutation, useQueryClient } from '@tanstack/react-query';
import { closeDay } from '@/insforge/queries/auditPeriods';

export function useCloseDay(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => closeDay(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-period', orgId] });
      qc.invalidateQueries({ queryKey: ['audit-history', orgId] });
    },
  });
}
