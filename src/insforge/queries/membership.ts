import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, type OrganizationMemberRowT } from '@/insforge/schemas';

export async function fetchMyMembership(): Promise<OrganizationMemberRowT | null> {
  const { data, error } = await insforge.database
    .from('organization_members')
    .select('*')
    .limit(1)
    .single();

  if (error) throw error;
  if (!data) return null;
  return OrganizationMemberRow.parse(data);
}
