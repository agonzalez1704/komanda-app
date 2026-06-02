import * as WebBrowser from 'expo-web-browser';
import { insforge } from '@/insforge/client';

/**
 * Invokes the create-checkout-session edge function and opens the returned
 * Stripe Checkout URL in an in-app browser sheet.
 *
 * Resolves with `{ ok: true }` when the sheet closes cleanly. Callers should
 * invalidate the ['membership'] query afterwards — webhook may have flipped
 * subscription_status while the user was paying.
 */
export async function openCheckoutSession(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const { data, error } = await insforge.functions.invoke<{ url?: string; error?: string }>(
    'create-checkout-session',
    { body: {} },
  );
  if (error) return { ok: false, reason: error.message };
  if (!data?.url) return { ok: false, reason: data?.error ?? 'no_checkout_url' };
  await WebBrowser.openBrowserAsync(data.url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
  return { ok: true };
}
