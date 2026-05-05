import { z } from 'zod';

const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true }).or(z.string());

export const SubscriptionStatus = z.enum([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'expired',
]);
export type SubscriptionStatusT = z.infer<typeof SubscriptionStatus>;

export const OrganizationRow = z.object({
  id: uuid,
  name: z.string(),
  created_at: iso,
  // Subscription state (added in migration 0011_subscriptions.sql).
  // Nullable on the schema only as a defensive read — backfill made
  // trial_ends_at NOT NULL in the DB.
  subscription_status: SubscriptionStatus.default('trialing'),
  trial_ends_at: iso,
  current_period_end: iso.nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
});

const Role = z.enum(['admin', 'cashier', 'waiter', 'cook']);

export const OrganizationMemberRow = z.object({
  id: uuid,
  auth_user_id: uuid,
  org_id: uuid,
  role: Role,
  display_name: z.string(),
  created_at: iso,
});

export const InvitationRow = z.object({
  id: uuid,
  org_id: uuid,
  email: z.string().email(),
  role: Role,
  token: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expires_at: iso,
  accepted_at: iso.nullable(),
  accepted_by_auth_user_id: uuid.nullable(),
  created_by_auth_user_id: uuid,
  created_at: iso,
});

export type RoleT = z.infer<typeof Role>;

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
  period_id: uuid,
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

export const AuditPeriodStatus = z.enum(['open', 'closed']);
export const AuditPeriodRow = z.object({
  id: uuid,
  org_id: uuid,
  status: AuditPeriodStatus,
  opened_at: iso,
  opened_by_auth_user_id: uuid,
  closed_at: iso.nullable(),
  closed_by_auth_user_id: uuid.nullable(),
  reopened_at: iso.nullable(),
  reopened_by_auth_user_id: uuid.nullable(),
  reopen_reason: z.string().nullable(),
});

export const ExpenseCategoryRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  active: z.boolean(),
  sort_order: z.number().int(),
  created_at: iso,
});

export const ExpensePaidBy = z.enum(['cash', 'card', 'transfer', 'personal']);
export const ExpenseRow = z.object({
  id: uuid,
  org_id: uuid,
  period_id: uuid,
  amount_cents: z.number().int().positive(),
  category_id: uuid.nullable(),
  category_other_label: z.string().nullable(),
  note: z.string(),
  paid_by: ExpensePaidBy,
  voided: z.boolean(),
  voided_at: iso.nullable(),
  voided_by_auth_user_id: uuid.nullable(),
  void_reason: z.string().nullable(),
  created_at: iso,
  created_by_auth_user_id: uuid,
  updated_at: iso,
  local_uuid: uuid,
});

export const ComboRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  category: z.string(),
  price_cents: z.number().int().nonnegative(),
  active: z.boolean(),
  sort_order: z.number().int(),
  created_at: iso,
});
export type ComboRowT = z.infer<typeof ComboRow>;

export const ComboItemRow = z.object({
  id: uuid,
  combo_id: uuid,
  product_id: uuid,
  variant_id: uuid.nullable(),
  quantity: z.number().int().positive(),
  sort_order: z.number().int(),
});
export type ComboItemRowT = z.infer<typeof ComboItemRow>;

export const KomandaComboRow = z.object({
  id: uuid,
  komanda_id: uuid,
  org_id: uuid,
  combo_id: uuid.nullable(),
  name_snapshot: z.string(),
  category_snapshot: z.string(),
  price_cents_snapshot: z.number().int().nonnegative(),
  created_at: iso,
  local_uuid: uuid,
});
export type KomandaComboRowT = z.infer<typeof KomandaComboRow>;

export type KomandaStatusT = z.infer<typeof KomandaStatus>;
export type PaymentMethodT = z.infer<typeof PaymentMethod>;
export type OrganizationRowT = z.infer<typeof OrganizationRow>;
export type OrganizationMemberRowT = z.infer<typeof OrganizationMemberRow>;
export type InvitationRowT = z.infer<typeof InvitationRow>;
export type ProductRowT = z.infer<typeof ProductRow>;
export type VariantRowT = z.infer<typeof VariantRow>;
export type ModifierRowT = z.infer<typeof ModifierRow>;
export type KomandaRowT = z.infer<typeof KomandaRow>;
export type AuditPeriodStatusT = z.infer<typeof AuditPeriodStatus>;
export type AuditPeriodRowT = z.infer<typeof AuditPeriodRow>;
export type ExpenseCategoryRowT = z.infer<typeof ExpenseCategoryRow>;
export type ExpensePaidByT = z.infer<typeof ExpensePaidBy>;
export type ExpenseRowT = z.infer<typeof ExpenseRow>;
