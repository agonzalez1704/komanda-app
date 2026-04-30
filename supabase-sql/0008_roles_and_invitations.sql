-- Roles & Invitations: extend the role taxonomy from ('admin','member') to
-- ('admin','cashier','waiter','cook'), give invitations a lifecycle (status +
-- accepted_by), and replace redeem_invitation. 'member' is kept in the CHECK
-- list for safe rollback; a follow-up migration will drop it once stable.

-- ---------------------------------------------------------------------------
-- 1. Expand role CHECK constraints (DROP + ADD; CHECK can't be altered).
-- ---------------------------------------------------------------------------

-- organization_members: drop any prior role check then re-add the wider one.
do $$
declare
  v_conname text;
begin
  for v_conname in
    select conname
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%in%'
  loop
    execute format('alter table public.organization_members drop constraint %I', v_conname);
  end loop;
end$$;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('admin','cashier','waiter','cook','member'));

-- invitations: same dance.
do $$
declare
  v_conname text;
begin
  for v_conname in
    select conname
    from pg_constraint
    where conrelid = 'public.invitations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%in%'
  loop
    execute format('alter table public.invitations drop constraint %I', v_conname);
  end loop;
end$$;

alter table public.invitations
  add constraint invitations_role_check
  check (role in ('admin','cashier','waiter','cook','member'));

-- ---------------------------------------------------------------------------
-- 2. Migrate existing 'member' rows to 'waiter'.
-- ---------------------------------------------------------------------------

update public.organization_members set role = 'waiter' where role = 'member';
update public.invitations           set role = 'waiter' where role = 'member';

-- ---------------------------------------------------------------------------
-- 3. invitations.status column + backfill.
-- ---------------------------------------------------------------------------

alter table public.invitations
  add column if not exists status text not null default 'pending';

-- Drop a prior status check (if re-running) so we can reassert it.
do $$
declare
  v_conname text;
begin
  for v_conname in
    select conname
    from pg_constraint
    where conrelid = 'public.invitations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%in%'
  loop
    execute format('alter table public.invitations drop constraint %I', v_conname);
  end loop;
end$$;

alter table public.invitations
  add constraint invitations_status_check
  check (status in ('pending','accepted','revoked','expired'));

-- Backfill: derive status from accepted_at / expires_at.
update public.invitations
  set status = case
    when accepted_at is not null then 'accepted'
    when expires_at <= now()     then 'expired'
    else 'pending'
  end
  where status = 'pending'; -- only touch defaults; preserve any manual values.

-- ---------------------------------------------------------------------------
-- 4. invitations.accepted_by_auth_user_id column.
-- ---------------------------------------------------------------------------

alter table public.invitations
  add column if not exists accepted_by_auth_user_id uuid references auth.users(id);

-- ---------------------------------------------------------------------------
-- 5. Indexes.
-- ---------------------------------------------------------------------------

create index if not exists invitations_token_idx      on public.invitations(token);
create index if not exists invitations_org_status_idx on public.invitations(org_id, status);

-- ---------------------------------------------------------------------------
-- 6. RLS policies for invitations.
--    - admin-of-same-org full read+write (replaces the old admin policies)
--    - public select-by-token so the accept-invite preview works unauthenticated
-- ---------------------------------------------------------------------------

-- Make sure RLS is on (idempotent; matches 0002_rls.sql).
alter table public.invitations enable row level security;

-- Drop prior policies to keep this file re-runnable.
drop policy if exists invitations_select_admin     on public.invitations;
drop policy if exists invitations_write_admin      on public.invitations;
drop policy if exists invitations_delete_admin     on public.invitations;
drop policy if exists invitations_update_admin     on public.invitations;
drop policy if exists invitations_select_by_token  on public.invitations;
drop policy if exists invitations_all_admin        on public.invitations;

-- Admin of the same org: full read+write.
create policy invitations_all_admin on public.invitations
  for all
  using (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  )
  with check (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );

-- Public select-by-token. The token itself is the credential; the table holds
-- only email + role + status, no other PII. Allowing anon read by token is
-- what the accept-invite preview screen needs before sign-in.
create policy invitations_select_by_token on public.invitations
  for select
  using (token is not null);

-- ---------------------------------------------------------------------------
-- 7. RLS additions on organization_members: admins UPDATE/DELETE in their org.
-- ---------------------------------------------------------------------------

drop policy if exists organization_members_update_admin on public.organization_members;
drop policy if exists organization_members_delete_admin on public.organization_members;

create policy organization_members_update_admin on public.organization_members
  for update
  using (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  )
  with check (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );

create policy organization_members_delete_admin on public.organization_members
  for delete
  using (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 8. Replace redeem_invitation RPC.
--    Looks up by token under FOR UPDATE, validates pending+unexpired, rejects
--    duplicate membership, inserts member with email-derived display_name
--    (client overwrites afterward), marks invitation accepted, returns row.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_invitation(p_token text)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_invitation public.invitations%rowtype;
  v_member     public.organization_members%rowtype;
begin
  -- Caller must be signed in.
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Look up invitation under row lock.
  select * into v_invitation
    from public.invitations
    where token = p_token
    for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if v_invitation.expires_at < now() then
    -- Lazy-expire so future lookups see the right state.
    update public.invitations
      set status = 'expired'
      where id = v_invitation.id;
    raise exception 'invitation_expired';
  end if;

  -- Reject duplicate membership in the same org.
  if exists (
    select 1 from public.organization_members
    where auth_user_id = v_uid and org_id = v_invitation.org_id
  ) then
    raise exception 'already_member';
  end if;

  -- Insert membership using the invitation's role.
  -- display_name defaults to the invitation email; the client updates it
  -- after redeem with the user's chosen display name.
  insert into public.organization_members (auth_user_id, org_id, role, display_name)
  values (
    v_uid,
    v_invitation.org_id,
    v_invitation.role,
    v_invitation.email::text
  )
  returning * into v_member;

  -- Mark invitation accepted.
  update public.invitations
    set status                   = 'accepted',
        accepted_at              = now(),
        accepted_by_auth_user_id = v_uid
    where id = v_invitation.id;

  return v_member;
end;
$$;

grant execute on function public.redeem_invitation(text) to authenticated;
