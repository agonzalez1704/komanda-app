import { useMutation, useQueryClient } from '@tanstack/react-query';
import { redeemInvitation } from '@/insforge/queries/invitations';

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => redeemInvitation(token),
    onSuccess: () => {
      // Force layout to re-fetch membership and route into (app).
      qc.invalidateQueries({ queryKey: ['membership'] });
    },
  });
}
