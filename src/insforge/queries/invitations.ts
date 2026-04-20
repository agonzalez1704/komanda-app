import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, type OrganizationMemberRowT } from '@/insforge/schemas';

export async function redeemInvitation(token: string): Promise<OrganizationMemberRowT> {
  const { data, error } = await insforge.database.rpc('redeem_invitation', { p_token: token });
  if (error) throw error;
  return OrganizationMemberRow.parse(data);
}
