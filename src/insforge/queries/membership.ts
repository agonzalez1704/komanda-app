import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, OrganizationRow } from '@/insforge/schemas';

const Joined = OrganizationMemberRow.extend({
  organization: OrganizationRow,
});
export type MembershipWithOrg = z.infer<typeof Joined>;

export async function fetchMyMembership(): Promise<MembershipWithOrg | null> {
  const { data, error } = await insforge.database
    .from('organization_members')
    .select('*, organization:organizations(*)')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return Joined.parse(data);
}
