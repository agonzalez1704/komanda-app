import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Landing for the `komanda:///billing/success` deep link Stripe sends us
 * after Checkout. Invalidate the membership cache so the (app) layout's
 * paywall gate re-evaluates against the now-active subscription, then
 * redirect into the app shell. The (app) layout decides what to render
 * from there based on the fresh org row.
 */
export default function BillingSuccess() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['membership'] });
  }, [qc]);
  return <Redirect href="/(app)/komandas" />;
}
