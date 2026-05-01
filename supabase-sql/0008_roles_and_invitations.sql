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
--    `token` is already covered by the unique constraint's implicit index
--    (see 0001_schema.sql: `token text not null unique`); we only add the
--    composite for the admin "list pending invites by org" query.
-- ---------------------------------------------------------------------------

create index if not exists invitations_org_status_idx on public.invitations(org_id, status);

-- ---------------------------------------------------------------------------
-- 6. RLS policies for invitations.
--    Admin-of-same-org has full read+write. We do NOT add a public/anon SELECT
--    policy: a `using (token is not null)` would let anon enumerate every row.
--    The accept-invite preview reads via the `lookup_invitation(p_token)` RPC
--    below, which is `security definer` and only returns one row at a time.
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

-- Drop the prior single-arg signature so create-or-replace doesn't conflict.
drop function if exists public.redeem_invitation(text);

create or replace function public.redeem_invitation(p_token text, p_display_name text default null)
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

  -- Insert membership atomically with the user-supplied display_name (falls
  -- back to the invitation email when the caller didn't pass one or sent
  -- whitespace). Doing this in the RPC instead of as a follow-up UPDATE
  -- avoids the RLS gap: non-admins have no UPDATE policy on
  -- organization_members, so a client-side post-redeem update would silently
  -- be filtered to zero rows.
  -- The exception handler covers the rare race where a concurrent redeem
  -- won the membership-existence check and committed first; without it the
  -- caller would see a raw 23505 instead of `already_member`.
  begin
    insert into public.organization_members (auth_user_id, org_id, role, display_name)
    values (
      v_uid,
      v_invitation.org_id,
      v_invitation.role,
      coalesce(nullif(trim(p_display_name), ''), v_invitation.email::text)
    )
    returning * into v_member;
  exception when unique_violation then
    raise exception 'already_member';
  end;

  -- Mark invitation accepted.
  update public.invitations
    set status                   = 'accepted',
        accepted_at              = now(),
        accepted_by_auth_user_id = v_uid
    where id = v_invitation.id;

  return v_member;
end;
$$;

grant execute on function public.redeem_invitation(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. lookup_invitation RPC: anon-callable preview of a single invitation by
--    token. Returns only the fields the accept-invite screen needs (no
--    `created_by`, no `accepted_*`). `security definer` lets us bypass RLS
--    for this single row without opening the whole table to anon SELECTs.
-- ---------------------------------------------------------------------------

create or replace function public.lookup_invitation(p_token text)
returns table (
  org_id      uuid,
  org_name    text,
  role        text,
  email       text,
  status      text,
  expires_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.org_id,
         o.name        as org_name,
         i.role,
         i.email::text as email,
         i.status,
         i.expires_at
    from public.invitations i
    join public.organizations o on o.id = i.org_id
    where i.token = p_token
    limit 1;
$$;

grant execute on function public.lookup_invitation(text) to anon, authenticated;
