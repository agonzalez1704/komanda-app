import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeMember } from '@/insforge/queries/members';
import type { RoleT } from '@/insforge/schemas';

export function useRemoveMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; role: RoleT }) =>
      removeMember({ ...input, orgId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', orgId] }),
  });
}
