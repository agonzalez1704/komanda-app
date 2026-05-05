/**
 * Billing helpers shared between BillingBanner + BillingPaywall.
 * Mirrors the SQL functions org_has_access / org_effective_status from
 * migration 0011_subscriptions.sql so the UI doesn't roundtrip per check.
 */

import type { SubscriptionStatusT } from '@/insforge/schemas';

export type OrgBilling = {
  id: string;
  name: string;
  subscription_status: SubscriptionStatusT;
  trial_ends_at: string;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

export const BILLING_URL =
  process.env.EXPO_PUBLIC_BILLING_URL ?? 'https://komanda.app/billing';

export function effectiveStatus(org: OrgBilling): SubscriptionStatusT {
  if (
    org.subscription_status === 'trialing' &&
    new Date(org.trial_ends_at).getTime() <= Date.now()
  ) {
    return 'expired';
  }
  return org.subscription_status;
}

export function hasAccess(org: OrgBilling): boolean {
  switch (org.subscription_status) {
    case 'active':
      return true;
    case 'trialing':
      return new Date(org.trial_ends_at).getTime() > Date.now();
    case 'past_due':
      return (
        !!org.current_period_end &&
        new Date(org.current_period_end).getTime() > Date.now()
      );
    default:
      return false;
  }
}

export function daysRemaining(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * True when we should surface the trial countdown bar to the user.
 * Hide while > 7 days remain — no need to bug them yet.
 */
export function shouldShowTrialBanner(org: OrgBilling): boolean {
  if (org.subscription_status !== 'trialing') return false;
  return daysRemaining(org.trial_ends_at) <= 7;
}
