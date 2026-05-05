-- 0011_subscriptions.sql
-- Trial + Stripe subscription state on organizations.
-- Trial-first model: every new org gets a trial window. Stripe customer +
-- subscription are created lazily when the user adds payment, so on signup
-- there's nothing to talk to Stripe about yet.

-- Add columns. Idempotent so reapplying is safe.
alter table public.organizations
  add column if not exists subscription_status   text not null default 'trialing',
  add column if not exists trial_ends_at         timestamptz,
  add column if not exists stripe_customer_id    text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end    timestamptz;

-- Constrain status to known values. Wrapped because ALTER ADD CONSTRAINT
-- isn't natively idempotent.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'organizations_subscription_status_check'
  ) then
    alter table public.organizations
      add constraint organizations_subscription_status_check
      check (subscription_status in (
        'trialing','active','past_due','canceled','unpaid','expired'
      ));
  end if;
end $$;

-- Backfill trial window for orgs that existed before this migration. Give
-- everyone a fresh 14-day window from now so the deploy doesn't lock anyone
-- out mid-service.
update public.organizations
   set trial_ends_at = now() + interval '14 days'
 where trial_ends_at is null;

alter table public.organizations
  alter column trial_ends_at set not null;

-- Indexes used by the Stripe webhook handler to find the org from Stripe ids.
create index if not exists organizations_stripe_customer_id_idx
  on public.organizations(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists organizations_stripe_subscription_id_idx
  on public.organizations(stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Single source of truth for paywall: does this org have access right now?
-- Used by future RLS gates and by app code. Keep the rule here, not scattered.
create or replace function public.org_has_access(p_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when subscription_status = 'active'
      then true
    when subscription_status = 'trialing' and trial_ends_at > now()
      then true
    when subscription_status = 'past_due' and current_period_end > now()
      then true
    else false
  end
  from public.organizations
  where id = p_org_id
$$;

grant execute on function public.org_has_access(uuid) to authenticated;

-- User-facing status — collapses an expired trial into 'expired' so the UI
-- doesn't have to recompute the rule client-side.
create or replace function public.org_effective_status(p_org_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when subscription_status = 'trialing' and trial_ends_at <= now()
      then 'expired'
    else subscription_status
  end
  from public.organizations
  where id = p_org_id
$$;

grant execute on function public.org_effective_status(uuid) to authenticated;

-- Update create_organization_and_member to accept a trial_days argument so
-- the app's TRIAL_DAYS constant (app/_lib/config.ts) remains the single
-- source of truth for trial length. Default 14 keeps existing 2-arg callers
-- (mobile app) working.
--
-- Adding a parameter changes the function signature, so drop the old one
-- first.
drop function if exists public.create_organization_and_member(text, text);

create or replace function public.create_organization_and_member(
  p_name text,
  p_display_name text,
  p_trial_days integer default 14
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_days integer := greatest(coalesce(p_trial_days, 14), 0);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required';
  end if;

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'display_name_required';
  end if;

  if exists (
    select 1 from public.organization_members where auth_user_id = v_uid
  ) then
    raise exception 'already_member';
  end if;

  insert into public.organizations (name, subscription_status, trial_ends_at)
  values (trim(p_name), 'trialing', now() + make_interval(days => v_days))
  returning id into v_org_id;

  insert into public.organization_members (
    auth_user_id, org_id, role, display_name
  )
  values (v_uid, v_org_id, 'admin', trim(p_display_name));

  return v_org_id;
end;
$$;

grant execute on function public.create_organization_and_member(
  text, text, integer
) to authenticated;
