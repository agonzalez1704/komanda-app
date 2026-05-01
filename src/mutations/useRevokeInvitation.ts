import { useMutation, useQueryClient } from '@tanstack/react-query';
import { revokeInvitation } from '@/insforge/queries/invitations';

export function useRevokeInvitation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations', orgId] }),
  });
}
