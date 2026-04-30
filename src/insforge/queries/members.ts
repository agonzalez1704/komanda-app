import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, type OrganizationMemberRowT, type RoleT } from '@/insforge/schemas';

const List = z.array(OrganizationMemberRow);

export async function listMembers(orgId: string): Promise<OrganizationMemberRowT[]> {
  const { data, error } = await insforge.database
    .from('organization_members')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return List.parse(data ?? []);
}

async function countAdmins(orgId: string): Promise<number> {
  const { count, error } = await insforge.database
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'admin');
  if (error) throw error;
  return count ?? 0;
}

export async function changeMemberRole(input: {
  memberId: string;
  orgId: string;
  currentRole: RoleT;
  nextRole: RoleT;
}): Promise<OrganizationMemberRowT> {
  if (input.currentRole === 'admin' && input.nextRole !== 'admin') {
    if ((await countAdmins(input.orgId)) <= 1) throw new Error('last_admin');
  }
  const { data, error } = await insforge.database
    .from('organization_members')
    .update({ role: input.nextRole })
    .eq('id', input.memberId)
    .select('*')
    .single();
  if (error) throw error;
  return OrganizationMemberRow.parse(data);
}

export async function removeMember(input: {
  memberId: string;
  orgId: string;
  role: RoleT;
}): Promise<void> {
  if (input.role === 'admin') {
    if ((await countAdmins(input.orgId)) <= 1) throw new Error('last_admin');
  }
  const { error } = await insforge.database
    .from('organization_members')
    .delete()
    .eq('id', input.memberId);
  if (error) throw error;
}
