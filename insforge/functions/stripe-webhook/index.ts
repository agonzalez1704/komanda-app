// Stripe webhook → keep organizations.subscription_status in sync.
//
// Events we care about:
//   checkout.session.completed       — first successful subscription mint
//   customer.subscription.updated    — status, period, plan changes
//   customer.subscription.deleted    — cancellation took effect
//   invoice.payment_failed           — flips to past_due
//   invoice.payment_succeeded        — flips back to active + extends period
//
// We resolve org by stripe_subscription_id, falling back to stripe_customer_id,
// then to subscription.metadata.org_id (set when we minted the session).

import { createClient } from 'npm:@insforge/sdk@^1.2.5';
import Stripe from 'npm:stripe@^17.5.0';

const ok = () => new Response('ok', { status: 200 });
const bad = (msg: string, status = 400) => new Response(msg, { status });

export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') return bad('method_not_allowed', 405);

  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const serviceKey = Deno.env.get('INSFORGE_SERVICE_KEY');
  if (!baseUrl || !stripeKey || !whSecret || !serviceKey) return bad('misconfigured', 500);

  const sig = req.headers.get('stripe-signature');
  if (!sig) return bad('missing_signature', 400);

  const raw = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  // Authenticity strategy:
  //   1. Try standard HMAC signature verification on the raw body.
  //   2. If that fails (Insforge's edge proxy re-encodes JSON before we see
  //      it, breaking byte-level signature checks), fall back to extracting
  //      the event id from the body and re-fetching the authoritative event
  //      from the Stripe API. That call is authenticated by our secret key,
  //      so the trust boundary is still our STRIPE_SECRET_KEY — an attacker
  //      who can hit this endpoint can only replay real event ids, and the
  //      handler is idempotent.
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
  } catch (sigErr) {
    let parsedId: string | undefined;
    try {
      parsedId = (JSON.parse(raw) as { id?: string }).id;
    } catch {
      // raw isn't JSON we can read — give up.
    }
    if (!parsedId) {
      const msg = (sigErr as Error).message;
      console.error('[stripe-webhook] signature verify failed and no event id', { msg });
      return bad(`signature_invalid: ${msg}`, 400);
    }
    try {
      event = await stripe.events.retrieve(parsedId);
      console.warn('[stripe-webhook] sig verify failed, fell back to retrieve', parsedId);
    } catch (fetchErr) {
      console.error('[stripe-webhook] retrieve fallback failed', parsedId, fetchErr);
      return bad('event_retrieve_failed', 400);
    }
  }
  console.log('[stripe-webhook] received', event.type, event.id);

  const admin = createClient({ baseUrl, anonKey: serviceKey });

  async function applyToOrg(
    selector: { sub?: string; cust?: string; orgId?: string },
    patch: Record<string, unknown>,
  ) {
    let orgId = selector.orgId;
    if (!orgId && selector.sub) {
      const { data } = await admin.database
        .from('organizations')
        .select('id')
        .eq('stripe_subscription_id', selector.sub)
        .limit(1)
        .maybeSingle();
      orgId = data?.id;
    }
    if (!orgId && selector.cust) {
      const { data } = await admin.database
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', selector.cust)
        .limit(1)
        .maybeSingle();
      orgId = data?.id;
    }
    if (!orgId) {
      console.warn('[stripe-webhook] no org match', selector, event.type);
      return;
    }
    const { error } = await admin.database
      .from('organizations')
      .update(patch)
      .eq('id', orgId);
    if (error) console.warn('[stripe-webhook] update failed', orgId, error);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode !== 'subscription') break;
      const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
      const custId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
      const orgId = s.client_reference_id ?? undefined;
      if (!subId) break;
      const sub = await stripe.subscriptions.retrieve(subId);
      await applyToOrg(
        { sub: subId, cust: custId, orgId },
        {
          stripe_subscription_id: subId,
          stripe_customer_id: custId ?? null,
          subscription_status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        },
      );
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = (sub.metadata?.org_id as string | undefined) ?? undefined;
      const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      await applyToOrg(
        { sub: sub.id, cust: custId, orgId },
        {
          subscription_status: sub.status,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        },
      );
      break;
    }
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as Stripe.Invoice;
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
      const custId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
      if (!subId) break;
      const sub = await stripe.subscriptions.retrieve(subId);
      await applyToOrg(
        { sub: subId, cust: custId, orgId: sub.metadata?.org_id as string | undefined },
        {
          subscription_status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        },
      );
      break;
    }
  }

  return ok();
}
