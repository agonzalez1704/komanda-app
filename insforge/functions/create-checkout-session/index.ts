// Create a Stripe Checkout Session for the caller's org. Returns { url }.
//
// Trial-ends or canceled state surfaces BillingPaywall in the app, which
// invokes this function. We resolve the caller via their JWT, look up their
// org, lazily create a Stripe customer if needed, then mint a subscription
// Checkout Session anchored to STRIPE_PRICE_ID.

import { createClient } from 'npm:@insforge/sdk@^1.2.5';
import Stripe from 'npm:stripe@^17.5.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const priceId = Deno.env.get('STRIPE_PRICE_ID');
  const serviceKey = Deno.env.get('INSFORGE_SERVICE_KEY');
  if (!baseUrl || !stripeKey || !priceId || !serviceKey) {
    return json({ error: 'misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  const userToken = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
  if (!userToken) return json({ error: 'unauthorized' }, 401);

  const userClient = createClient({ baseUrl, edgeFunctionToken: userToken });
  const { data: userData } = await userClient.auth.getCurrentUser();
  const userId = userData?.user?.id;
  const userEmail = userData?.user?.email;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  // Read the caller's org through their own JWT — RLS already scopes this to
  // their membership row, so we don't need service-role to fetch it.
  const { data: member, error: memberErr } = await userClient.database
    .from('organization_members')
    .select('org_id, organization:organizations(id,name,stripe_customer_id)')
    .eq('auth_user_id', userId)
    .limit(1)
    .maybeSingle();
  if (memberErr) return json({ error: 'membership_read_failed', detail: memberErr.message }, 500);
  if (!member?.organization) return json({ error: 'no_org' }, 404);

  const org = member.organization as { id: string; name: string; stripe_customer_id: string | null };

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  // Service-role client writes back stripe_customer_id when we mint one.
  // Org rows can't be UPDATEd by members directly under RLS.
  const admin = createClient({ baseUrl, anonKey: serviceKey });

  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail ?? undefined,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    const { error: updateErr } = await admin.database
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', org.id);
    if (updateErr) {
      // Customer exists in Stripe but we couldn't persist the id. Webhook
      // will reconcile via the customer.metadata.org_id we set above.
      console.warn('[create-checkout-session] failed to persist customer id', updateErr);
    }
  }

  const returnBase = Deno.env.get('BILLING_RETURN_URL') ?? `${baseUrl}/functions/billing-return`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnBase}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnBase}?status=cancel`,
    client_reference_id: org.id,
    subscription_data: { metadata: { org_id: org.id } },
    allow_promotion_codes: true,
  });

  if (!session.url) return json({ error: 'no_checkout_url' }, 500);
  return json({ url: session.url });
}
