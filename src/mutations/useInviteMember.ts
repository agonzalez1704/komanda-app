import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvitation } from '@/insforge/queries/invitations';
import { useSession } from '@/insforge/session';
import type { RoleT } from '@/insforge/schemas';

export function useInviteMember(orgId: string) {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: (input: { email: string; role: RoleT }) => {
      if (session.status !== 'signed-in') throw new Error('not_signed_in');
      return createInvitation({
        orgId,
        email: input.email,
        role: input.role,
        createdByAuthUserId: session.session.userId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations', orgId] }),
  });
}
