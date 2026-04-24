import { insforge } from '@/insforge/client';
import { z } from 'zod';

const CreateOrgResult = z.string().uuid();

export async function createOrganizationAndMember(
  name: string,
  displayName: string
): Promise<string> {
  const { data, error } = await insforge.database.rpc('create_organization_and_member', {
    p_name: name,
    p_display_name: displayName,
  });
  if (error) throw error;
  return CreateOrgResult.parse(data);
}
