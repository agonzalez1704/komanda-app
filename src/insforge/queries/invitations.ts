import { z } from 'zod';
import { insforge } from '@/insforge/client';
import {
  InvitationRow,
  OrganizationMemberRow,
  type InvitationRowT,
  type OrganizationMemberRowT,
  type RoleT,
} from '@/insforge/schemas';
import { randomCode } from '@/auth/randomCode';

const InvitationList = z.array(InvitationRow);

export async function listPendingInvitations(orgId: string): Promise<InvitationRowT[]> {
  const { data, error } = await insforge.database
    .from('invitations')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return InvitationList.parse(data ?? []);
}

export async function createInvitation(input: {
  orgId: string;
  email: string;
  role: RoleT;
  createdByAuthUserId: string;
}): Promise<InvitationRowT> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const token = randomCode();
  const { data, error } = await insforge.database
    .from('invitations')
    .insert({
      org_id: input.orgId,
      email: input.email,
      role: input.role,
      token,
      status: 'pending',
      expires_at: expiresAt,
      created_by_auth_user_id: input.createdByAuthUserId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return InvitationRow.parse(data);
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await insforge.database
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) throw error;
}

const PreviewSchema = z.object({
  org_id: z.string().uuid(),
  org_name: z.string(),
  role: z.enum(['admin', 'cashier', 'waiter', 'cook']),
  email: z.string().email(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expires_at: z.string(),
});
export type InvitationPreview = z.infer<typeof PreviewSchema>;

/**
 * Anon-callable preview by token. Backed by the SECURITY DEFINER RPC
 * lookup_invitation; we don't have a public SELECT policy on invitations.
 */
export async function lookupInvitation(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await insforge.database.rpc('lookup_invitation', { p_token: token });
  if (error) throw error;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  // RPC returns a setof; the SDK may surface it as an array or single row depending on shape.
  const row = Array.isArray(data) ? data[0] : data;
  return PreviewSchema.parse(row);
}

export async function redeemInvitation(token: string): Promise<OrganizationMemberRowT> {
  const { data, error } = await insforge.database.rpc('redeem_invitation', { p_token: token });
  if (error) throw error;
  return OrganizationMemberRow.parse(data);
}
