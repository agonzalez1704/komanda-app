import { Redirect } from 'expo-router';

/**
 * Landing for the `komanda:///billing/cancel` deep link. User backed out of
 * Stripe Checkout. Nothing changed server-side, so just bounce them home —
 * the (app) layout will re-show the paywall if access is still gated.
 */
export default function BillingCancel() {
  return <Redirect href="/(app)/komandas" />;
}
