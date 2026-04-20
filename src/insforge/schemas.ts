import { z } from 'zod';

const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true }).or(z.string());

export const OrganizationRow = z.object({
  id: uuid,
  name: z.string(),
  created_at: iso,
});

export const OrganizationMemberRow = z.object({
  id: uuid,
  auth_user_id: uuid,
  org_id: uuid,
  role: z.enum(['admin', 'member']),
  display_name: z.string(),
  created_at: iso,
});

export const InvitationRow = z.object({
  id: uuid,
  org_id: uuid,
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
  token: z.string(),
  expires_at: iso,
  accepted_at: iso.nullable(),
  created_by_auth_user_id: uuid,
  created_at: iso,
});

export const ProductRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  category: z.string(),
  price_cents: z.number().int().nonnegative(),
  active: z.boolean(),
  sort_order: z.number().int(),
  created_at: iso,
});

export const VariantRow = z.object({
  id: uuid,
  product_id: uuid,
  org_id: uuid,
  name: z.string(),
  active: z.boolean(),
  sort_order: z.number().int(),
});

export const ModifierRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  active: z.boolean(),
});

export const KomandaStatus = z.enum(['open', 'pending', 'served', 'closed']);
export const PaymentMethod = z.enum(['cash', 'card', 'transfer']);

export const KomandaRow = z.object({
  id: uuid,
  org_id: uuid,
  number: z.string().nullable(),
  display_name: z.string().nullable(),
  status: KomandaStatus,
  opened_by_auth_user_id: uuid,
  opened_at: iso,
  closed_at: iso.nullable(),
  closed_by_auth_user_id: uuid.nullable(),
  payment_method: PaymentMethod.nullable(),
  total_cents: z.number().int().nullable(),
  local_uuid: uuid,
});

export type KomandaStatusT = z.infer<typeof KomandaStatus>;
export type PaymentMethodT = z.infer<typeof PaymentMethod>;
export type OrganizationRowT = z.infer<typeof OrganizationRow>;
export type OrganizationMemberRowT = z.infer<typeof OrganizationMemberRow>;
export type InvitationRowT = z.infer<typeof InvitationRow>;
export type ProductRowT = z.infer<typeof ProductRow>;
export type VariantRowT = z.infer<typeof VariantRow>;
export type ModifierRowT = z.infer<typeof ModifierRow>;
export type KomandaRowT = z.infer<typeof KomandaRow>;
