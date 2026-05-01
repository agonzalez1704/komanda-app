import { useMutation, useQueryClient } from '@tanstack/react-query';
import { changeMemberRole } from '@/insforge/queries/members';
import type { RoleT } from '@/insforge/schemas';

export function useChangeMemberRole(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; currentRole: RoleT; nextRole: RoleT }) =>
      changeMemberRole({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] });
      qc.invalidateQueries({ queryKey: ['membership'] });
    },
  });
}
