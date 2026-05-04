-- 2026-05-04: Combos — admin-defined bundles + per-komanda placement.
-- Three new tables (combos, combo_items, komanda_combos) plus a nullable
-- combo_id on komanda_items linking child rows to their combo header. Two
-- RPCs (upsert_combo, add_komanda_combo) keep multi-row writes atomic.

-- ---------------------------------------------------------------------------
-- 1. Combo definition (per-org).
-- ---------------------------------------------------------------------------

create table if not exists public.combos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  category    text not null default 'Combos',
  price_cents integer not null check (price_cents >= 0),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists combos_org_idx on public.combos(org_id);

create table if not exists public.combo_items (
  id          uuid primary key default gen_random_uuid(),
  combo_id    uuid not null references public.combos(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  variant_id  uuid references public.variants(id),
  quantity    integer not null check (quantity > 0),
  sort_order  integer not null default 0
);
create index if not exists combo_items_combo_idx on public.combo_items(combo_id);

-- ---------------------------------------------------------------------------
-- 2. Combo placement on a komanda.
-- ---------------------------------------------------------------------------

create table if not exists public.komanda_combos (
  id                       uuid primary key default gen_random_uuid(),
  komanda_id               uuid not null references public.komandas(id) on delete cascade,
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  combo_id                 uuid references public.combos(id),
  name_snapshot            text not null,
  category_snapshot        text not null,
  price_cents_snapshot     integer not null check (price_cents_snapshot >= 0),
  created_at               timestamptz not null default now(),
  local_uuid               uuid not null,
  unique (komanda_id, local_uuid)
);
create index if not exists komanda_combos_komanda_idx on public.komanda_combos(komanda_id);

-- Children link via the existing komanda_items table.
alter table public.komanda_items
  add column if not exists combo_id uuid references public.komanda_combos(id) on delete cascade;
create index if not exists komanda_items_combo_idx on public.komanda_items(combo_id);

-- ---------------------------------------------------------------------------
-- 3. RLS.
-- ---------------------------------------------------------------------------

alter table public.combos          enable row level security;
alter table public.combo_items     enable row level security;
alter table public.komanda_combos  enable row level security;

drop policy if exists combos_select        on public.combos;
drop policy if exists combos_write_manager on public.combos;

create policy combos_select on public.combos
  for select using (org_id = public.current_org_id());

create policy combos_write_manager on public.combos
  for all
  using (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier')
  );

drop policy if exists combo_items_select        on public.combo_items;
drop policy if exists combo_items_write_manager on public.combo_items;

create policy combo_items_select on public.combo_items
  for select using (
    combo_id in (
      select id from public.combos where org_id = public.current_org_id()
    )
  );

create policy combo_items_write_manager on public.combo_items
  for all
  using (
    combo_id in (
      select id from public.combos
        where org_id = public.current_org_id()
          and public.current_org_role() in ('admin','cashier')
    )
  )
  with check (
    combo_id in (
      select id from public.combos
        where org_id = public.current_org_id()
          and public.current_org_role() in ('admin','cashier')
    )
  );

drop policy if exists komanda_combos_select       on public.komanda_combos;
drop policy if exists komanda_combos_write_worker on public.komanda_combos;

create policy komanda_combos_select on public.komanda_combos
  for select using (org_id = public.current_org_id());

create policy komanda_combos_write_worker on public.komanda_combos
  for all
  using (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier','waiter')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_org_role() in ('admin','cashier','waiter')
  );

-- ---------------------------------------------------------------------------
-- 4. RPC: upsert_combo (admin defines/updates a combo + composition atomically)
--    p_combo  jsonb: { id?, name, category, price_cents, active, sort_order }
--    p_items  jsonb: [{ product_id, variant_id?, quantity, sort_order }]
-- ---------------------------------------------------------------------------

drop function if exists public.upsert_combo(jsonb, jsonb);

create or replace function public.upsert_combo(p_combo jsonb, p_items jsonb)
returns public.combos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid := public.current_org_id();
  v_role  text := public.current_org_role();
  v_id    uuid;
  v_combo public.combos%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_org is null then
    raise exception 'no_org';
  end if;
  if v_role not in ('admin','cashier') then
    raise exception 'forbidden';
  end if;

  v_id := nullif(p_combo->>'id','')::uuid;

  if v_id is null then
    insert into public.combos (org_id, name, category, price_cents, active, sort_order)
    values (
      v_org,
      p_combo->>'name',
      coalesce(nullif(p_combo->>'category',''), 'Combos'),
      (p_combo->>'price_cents')::int,
      coalesce((p_combo->>'active')::boolean, true),
      coalesce((p_combo->>'sort_order')::int, 0)
    )
    returning * into v_combo;
  else
    update public.combos
       set name        = p_combo->>'name',
           category    = coalesce(nullif(p_combo->>'category',''), 'Combos'),
           price_cents = (p_combo->>'price_cents')::int,
           active      = coalesce((p_combo->>'active')::boolean, true),
           sort_order  = coalesce((p_combo->>'sort_order')::int, 0)
     where id = v_id and org_id = v_org
     returning * into v_combo;
    if not found then
      raise exception 'combo_not_found';
    end if;
  end if;

  -- Validate every product_id / variant_id referenced by the new
  -- composition belongs to the caller's org. Without this check a
  -- security-definer admin in org A could plant cross-org references via
  -- crafted JSON; the FK alone won't catch it (it's content-addressed by
  -- id, not scope).
  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it
      left join public.products p on p.id = (it->>'product_id')::uuid
     where p.org_id is null or p.org_id <> v_org
  ) then
    raise exception 'product_not_in_org';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it
     where nullif(it->>'variant_id','') is not null
       and not exists (
         select 1 from public.variants v
          where v.id = (it->>'variant_id')::uuid and v.org_id = v_org
       )
  ) then
    raise exception 'variant_not_in_org';
  end if;

  -- Replace composition wholesale.
  delete from public.combo_items where combo_id = v_combo.id;
  insert into public.combo_items (combo_id, product_id, variant_id, quantity, sort_order)
  select v_combo.id,
         (it->>'product_id')::uuid,
         nullif(it->>'variant_id','')::uuid,
         (it->>'quantity')::int,
         coalesce((it->>'sort_order')::int, 0)
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it;

  return v_combo;
end;
$$;

grant execute on function public.upsert_combo(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC: add_komanda_combo (waiter adds combo + children atomically).
--    p_children jsonb: [{ item_local_uuid, product_id, variant_id?, quantity,
--                         product_name_snapshot, variant_name_snapshot?,
--                         note_text?, modifiers: [{ modifier_id?, name_snapshot }] }]
-- ---------------------------------------------------------------------------

drop function if exists public.add_komanda_combo(uuid, uuid, uuid, text, text, integer, jsonb);

create or replace function public.add_komanda_combo(
  p_komanda_id            uuid,
  p_combo_id              uuid,
  p_local_uuid            uuid,
  p_name_snapshot         text,
  p_category_snapshot     text,
  p_price_cents_snapshot  integer,
  p_children              jsonb
)
returns public.komanda_combos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_org          uuid := public.current_org_id();
  v_role         text := public.current_org_role();
  v_combo_row    public.komanda_combos%rowtype;
  v_komanda_org  uuid;
  v_child        jsonb;
  v_item_id      uuid;
  v_mod          jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_org is null then
    raise exception 'no_org';
  end if;
  if v_role not in ('admin','cashier','waiter') then
    raise exception 'forbidden';
  end if;

  select org_id into v_komanda_org
    from public.komandas
    where id = p_komanda_id;

  if v_komanda_org is null then
    raise exception 'komanda_not_found';
  end if;
  if v_komanda_org <> v_org then
    raise exception 'forbidden';
  end if;

  -- Validate cross-org reference smuggling. SECURITY DEFINER bypasses RLS,
  -- so we must enforce same-org membership ourselves on every FK we accept
  -- from caller-controlled JSON: combo_id, child product_id / variant_id,
  -- modifier modifier_id.
  if p_combo_id is not null and not exists (
    select 1 from public.combos where id = p_combo_id and org_id = v_org
  ) then
    raise exception 'combo_not_in_org';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_children, '[]'::jsonb)) as ch
      left join public.products p on p.id = nullif(ch->>'product_id','')::uuid
     where nullif(ch->>'product_id','') is not null
       and (p.org_id is null or p.org_id <> v_org)
  ) then
    raise exception 'product_not_in_org';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_children, '[]'::jsonb)) as ch
     where nullif(ch->>'variant_id','') is not null
       and not exists (
         select 1 from public.variants v
          where v.id = (ch->>'variant_id')::uuid and v.org_id = v_org
       )
  ) then
    raise exception 'variant_not_in_org';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_children, '[]'::jsonb)) as ch,
           lateral jsonb_array_elements(coalesce(ch->'modifiers','[]'::jsonb)) as m
     where nullif(m->>'modifier_id','') is not null
       and not exists (
         select 1 from public.modifiers mo
          where mo.id = (m->>'modifier_id')::uuid and mo.org_id = v_org
       )
  ) then
    raise exception 'modifier_not_in_org';
  end if;

  insert into public.komanda_combos
    (komanda_id, org_id, combo_id, name_snapshot, category_snapshot,
     price_cents_snapshot, local_uuid)
  values
    (p_komanda_id, v_org, p_combo_id, p_name_snapshot, p_category_snapshot,
     p_price_cents_snapshot, p_local_uuid)
  returning * into v_combo_row;

  for v_child in select * from jsonb_array_elements(coalesce(p_children, '[]'::jsonb))
  loop
    insert into public.komanda_items
      (komanda_id, org_id, product_id, variant_id, quantity, unit_price_cents,
       product_name_snapshot, variant_name_snapshot, note_text, combo_id)
    values (
      p_komanda_id,
      v_org,
      nullif(v_child->>'product_id','')::uuid,
      nullif(v_child->>'variant_id','')::uuid,
      (v_child->>'quantity')::int,
      0,
      v_child->>'product_name_snapshot',
      nullif(v_child->>'variant_name_snapshot',''),
      nullif(v_child->>'note_text',''),
      v_combo_row.id
    )
    returning id into v_item_id;

    if (v_child ? 'modifiers') then
      for v_mod in select * from jsonb_array_elements(v_child->'modifiers')
      loop
        insert into public.komanda_item_modifiers
          (komanda_item_id, modifier_id, name_snapshot)
        values (
          v_item_id,
          nullif(v_mod->>'modifier_id','')::uuid,
          v_mod->>'name_snapshot'
        );
      end loop;
    end if;
  end loop;

  return v_combo_row;
end;
$$;

grant execute on function public.add_komanda_combo(uuid, uuid, uuid, text, text, integer, jsonb) to authenticated;
