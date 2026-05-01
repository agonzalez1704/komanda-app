import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, OrganizationRow } from '@/insforge/schemas';
import { AUTH_TOKEN_KEY } from '@/insforge/tokenPersistence';

const Joined = OrganizationMemberRow.extend({
  organization: OrganizationRow,
});
export type MembershipWithOrg = z.infer<typeof Joined>;

/**
 * Decode the `sub` claim from the persisted access token. This is the auth
 * user id we filter on so the membership query returns THIS user's row, not
 * "any member of an org I'm in" — RLS lets us see all rows in our org, so
 * without this filter a `.limit(1)` returns whichever row the planner
 * happens to read first (frequently the admin's, which manifested as
 * "waiter signs in but sees admin profile").
 */
async function currentAuthUserId(): Promise<string | null> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : (globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }).Buffer!.from(
            padded,
            'base64',
          ).toString('binary');
    const payload = JSON.parse(json);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function fetchMyMembership(): Promise<MembershipWithOrg | null> {
  const uid = await currentAuthUserId();
  if (!uid) return null;
  const { data, error } = await insforge.database
    .from('organization_members')
    .select('*, organization:organizations(*)')
    .eq('auth_user_id', uid)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return Joined.parse(data);
}
