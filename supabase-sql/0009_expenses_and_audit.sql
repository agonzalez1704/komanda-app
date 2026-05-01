-- Expenses & Audit: introduce per-org audit periods (one open at a time),
-- per-org expense categories with seeded defaults, and an expenses ledger.
-- Komandas gain a period_id link so closing a period freezes its history.
-- New RPCs `close_day` and `reopen_period` enforce the lifecycle invariants.

-- ---------------------------------------------------------------------------
-- 1. audit_periods table.
-- ---------------------------------------------------------------------------

create table if not exists public.audit_periods (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  status                    text not null check (status in ('open','closed')),
  opened_at                 timestamptz not null default now(),
  opened_by_auth_user_id    uuid not null references auth.users(id),
  closed_at                 timestamptz,
  closed_by_auth_user_id    uuid references auth.users(id),
  reopened_at               timestamptz,
  reopened_by_auth_user_id  uuid references auth.users(id),
  reopen_reason             text
);

create index if not exists audit_periods_org_idx on public.audit_periods(org_id);

-- Invariant: exactly one open period per org.
create unique index if not exists audit_periods_one_open_per_org
  on public.audit_periods(org_id) where status = 'open';

-- ---------------------------------------------------------------------------
-- 2. Backfill: ensure every org has an open period, attach existing komandas.
-- ---------------------------------------------------------------------------

-- For every org without an open period, insert one. Prefer an admin as
-- opener; fall back to any member so orgs without an admin don't get
-- stranded with komandas.period_id permanently nullable. Opener identity
-- here is for audit only — no role gating depends on it.
insert into public.audit_periods (org_id, status, opened_at, opened_by_auth_user_id)
select o.id, 'open', now(), m.auth_user_id
  from public.organizations o
  join lateral (
    select auth_user_id
      from public.organization_members
      where org_id = o.id
      order by case role when 'admin' then 0 when 'cashier' then 1 else 2 end,
               created_at
      limit 1
  ) m on true
  where not exists (
    select 1 from public.audit_periods p where p.org_id = o.id and p.status = 'open'
  );

-- Add komandas.period_id (nullable for backfill, then NOT NULL after).
alter table public.komandas
  add column if not exists period_id uuid references public.audit_periods(id);

update public.komandas k
   set period_id = (
     select id from public.audit_periods p
       where p.org_id = k.org_id and p.status = 'open'
       limit 1
   )
   where period_id is null;

-- Only flip to NOT NULL once every row has a period_id. The check guards
-- partial-state re-runs (e.g. an org with no admin would leave gaps above).
do $$
begin
  if not exists (select 1 from public.komandas where period_id is null) then
    if exists (
      select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'komandas'
          and column_name = 'period_id'
          and is_nullable = 'YES'
    ) then
      alter table public.komandas alter column period_id set not null;
    end if;
  end if;
end$$;

create index if not exists komandas_period_idx on public.komandas(period_id);

-- ---------------------------------------------------------------------------
-- 3. expense_categories: per-org CRUD + seeded defaults.
-- ---------------------------------------------------------------------------

create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists expense_categories_org_idx on public.expense_categories(org_id);

-- Seed default categories per org. Idempotent via UNIQUE (org_id, name).
insert into public.expense_categories (org_id, name, sort_order)
select o.id, c.name, c.idx
  from public.organizations o
  cross join (values
    ('Produce', 1),
    ('Supplies', 2),
    ('Repairs', 3),
    ('Utilities', 4)
  ) as c(name, idx)
  on conflict (org_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- 4. expenses ledger.
-- ---------------------------------------------------------------------------

create table if not exists public.expenses (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  period_id                uuid not null references public.audit_periods(id),
  amount_cents             integer not null check (amount_cents > 0),
  category_id              uuid references public.expense_categories(id),
  category_other_label     text,
  note                     text not null,
  paid_by                  text not null check (paid_by in ('cash','card','transfer','personal')),
  voided                   boolean not null default false,
  voided_at                timestamptz,
  voided_by_auth_user_id   uuid references auth.users(id),
  void_reason              text,
  created_at               timestamptz not null default now(),
  created_by_auth_user_id  uuid not null references auth.users(id),
  updated_at               timestamptz not null default now(),
  local_uuid               uuid not null,
  unique (org_id, local_uuid),
  -- Mutually exclusive: a saved category XOR an "other" free-text label.
  -- Sending both is rejected so audit aggregation by category_id never has
  -- to disambiguate which side wins.
  check (
    (category_id is not null and category_other_label is null) or
    (category_id is null and category_other_label is not null
       and length(trim(category_other_label)) > 0)
  )
);

create index if not exists expenses_period_idx on public.expenses(period_id);
create index if not exists expenses_org_created_idx on public.expenses(org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. RLS.
-- ---------------------------------------------------------------------------

alter table public.audit_periods       enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.expenses            enable row level security;

-- audit_periods: read = same-org members; write = admin or cashier.
drop policy if exists audit_periods_select         on public.audit_periods;
drop policy if exists audit_periods_write_staff    on public.audit_periods;

create policy audit_periods_select on public.audit_periods
  for select using (org_id = public.current_org_id());

create policy audit_periods_write_staff on public.audit_periods
  for all
  using (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier')
  );

-- expense_categories: read = same-org members; write = admin only.
drop policy if exists expense_categories_select       on public.expense_categories;
drop policy if exists expense_categories_write_admin  on public.expense_categories;

create policy expense_categories_select on public.expense_categories
  for select using (org_id = public.current_org_id());

create policy expense_categories_write_admin on public.expense_categories
  for all
  using (
    org_id = public.current_org_id()
    and public.current_org_role() = 'admin'
  )
  with check (
    org_id = public.current_org_id()
    and public.current_org_role() = 'admin'
  );

-- expenses: read + write restricted to admin/cashier in the same org.
drop policy if exists expenses_select_staff  on public.expenses;
drop policy if exists expenses_write_staff   on public.expenses;

create policy expenses_select_staff on public.expenses
  for select using (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier')
  );

create policy expenses_write_staff on public.expenses
  for all
  using (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier')
  );

-- ---------------------------------------------------------------------------
-- 6. RPC: close_day(p_org_id) — closes the open period and opens a fresh one.
-- ---------------------------------------------------------------------------

drop function if exists public.close_day(uuid);

create or replace function public.close_day(p_org_id uuid)
returns public.audit_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_role         text;
  v_open         public.audit_periods%rowtype;
  v_open_count   integer;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  -- Caller must be a member of the target org with an authorized role.
  select role into v_role
    from public.organization_members
    where auth_user_id = v_uid and org_id = p_org_id
    limit 1;

  if v_role is null or v_role not in ('admin','cashier') then
    raise exception 'forbidden';
  end if;

  -- Lock the current open period.
  select * into v_open
    from public.audit_periods
    where org_id = p_org_id and status = 'open'
    for update;

  if not found then
    raise exception 'no_open_period';
  end if;

  -- Refuse to close while any komanda in the period is still active.
  select count(*) into v_open_count
    from public.komandas
    where period_id = v_open.id and status <> 'closed';

  if v_open_count > 0 then
    raise exception 'open_komandas:%', v_open_count;
  end if;

  -- Close the period and capture the now-closed row to return.
  update public.audit_periods
    set status                 = 'closed',
        closed_at              = now(),
        closed_by_auth_user_id = v_uid
    where id = v_open.id
    returning * into v_open;

  -- Open a fresh period so the org always has exactly one open period.
  insert into public.audit_periods (org_id, status, opened_at, opened_by_auth_user_id)
  values (p_org_id, 'open', now(), v_uid);

  return v_open;
end;
$$;

grant execute on function public.close_day(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: reopen_period(p_period_id, p_reason) — admin-only, requires the
--    current open period to be empty (no komandas, no expenses).
-- ---------------------------------------------------------------------------

drop function if exists public.reopen_period(uuid, text);

create or replace function public.reopen_period(p_period_id uuid, p_reason text)
returns public.audit_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_target    public.audit_periods%rowtype;
  v_current   public.audit_periods%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  -- Lock the target period.
  select * into v_target
    from public.audit_periods
    where id = p_period_id
    for update;

  if not found then
    raise exception 'period_not_found';
  end if;

  -- Caller must be admin of the target's org.
  select role into v_role
    from public.organization_members
    where auth_user_id = v_uid and org_id = v_target.org_id
    limit 1;

  if v_role is null or v_role <> 'admin' then
    raise exception 'forbidden';
  end if;

  if v_target.status <> 'closed' then
    raise exception 'period_not_closed';
  end if;

  -- Lock the current open period for the same org. If there is none (rare —
  -- can happen if a prior close_day failed mid-flight, leaving an org with
  -- zero open periods), fall through and just flip the target back to open;
  -- the partial unique index will be satisfied either way.
  select * into v_current
    from public.audit_periods
    where org_id = v_target.org_id and status = 'open'
    for update;

  if found then
    if exists (select 1 from public.komandas where period_id = v_current.id)
       or exists (select 1 from public.expenses where period_id = v_current.id) then
      raise exception 'current_period_not_empty';
    end if;

    -- Drop the empty current period to satisfy the partial unique index.
    delete from public.audit_periods where id = v_current.id;
  end if;

  -- Reopen the target.
  update public.audit_periods
    set status                   = 'open',
        reopened_at              = now(),
        reopened_by_auth_user_id = v_uid,
        reopen_reason            = p_reason,
        closed_at                = null,
        closed_by_auth_user_id   = null
    where id = v_target.id
    returning * into v_target;

  return v_target;
end;
$$;

grant execute on function public.reopen_period(uuid, text) to authenticated;
