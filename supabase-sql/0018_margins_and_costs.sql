-- 0018_margins_and_costs.sql
-- Admin-only "Margins & Costs" feature.
--
-- Adds per-org tunable margin assumptions (Uber commission %, IVA retention,
-- markup factors), an ingredient catalog, product recipe lines, fixed daily
-- cost rows, and a nullable Uber Eats price override on products.
--
-- All new tables are admin-only via RLS (current_org_role() = 'admin') —
-- cashier/waiter/cook cannot read or write them. The products column is
-- readable by anyone with menu read access, but writes go through a new
-- admin-only mutation path (see src/mutations/useSetUberPrice.ts).

-- ---------------------------------------------------------------------------
-- 1. Per-org margin assumptions (Uber %, IVA retention, markup factors A/B).
-- ---------------------------------------------------------------------------
create table if not exists public.margin_assumptions (
  org_id                  uuid primary key references public.organizations(id) on delete cascade,
  uber_commission_pct     numeric(6,4) not null default 0.3464,
  uber_iva_retention_pct  numeric(6,4) not null default 0.0951,
  markup_a                numeric(6,4) not null default 1.5300,
  markup_b                numeric(6,4) not null default 1.7900,
  updated_at              timestamptz  not null default now(),
  check (uber_commission_pct    between 0 and 1),
  check (uber_iva_retention_pct between 0 and 1),
  check (markup_a > 1),
  check (markup_b > 1)
);

-- ---------------------------------------------------------------------------
-- 2. Ingredient catalog. unit ∈ {g, ml, unit}. cost_cents_per_unit is the
--    cost of one unit (1 g, 1 ml, 1 piece) — store at small-unit resolution
--    so recipe quantities can stay in natural numbers.
-- ---------------------------------------------------------------------------
create table if not exists public.ingredients (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  unit                text not null check (unit in ('g','ml','unit')),
  cost_cents_per_unit numeric(12,4) not null check (cost_cents_per_unit >= 0),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (org_id, name)
);
create index if not exists ingredients_org_idx on public.ingredients(org_id);

-- ---------------------------------------------------------------------------
-- 3. Product recipe lines. Each line: this product uses `quantity` units of
--    `ingredient_id` per portion. (g for solid ingredients, ml for liquids,
--    pieces for `unit`-priced items like bread.)
-- ---------------------------------------------------------------------------
create table if not exists public.product_recipe_lines (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  product_id    uuid not null references public.products(id)    on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity      numeric(12,3) not null check (quantity > 0),
  created_at    timestamptz not null default now(),
  unique (product_id, ingredient_id)
);
create index if not exists recipe_lines_product_idx on public.product_recipe_lines(product_id);
create index if not exists recipe_lines_org_idx     on public.product_recipe_lines(org_id);

-- ---------------------------------------------------------------------------
-- 4. Free-form fixed daily costs. Owner can add labor, rent (daily share),
--    gas, condiments, packaging — no migration needed for new buckets. The
--    `notes` field is used for "restock cash bucket" working notes.
-- ---------------------------------------------------------------------------
create table if not exists public.fixed_costs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  label       text not null,
  daily_cents integer not null check (daily_cents >= 0),
  notes       text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists fixed_costs_org_idx on public.fixed_costs(org_id);

-- ---------------------------------------------------------------------------
-- 5. Optional per-product Uber Eats sale price override. Null = derive from
--    price_cents * markup_a (or _b, depending on the assumptions screen
--    default). Stored on products so existing menu queries see it.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists uber_price_cents integer
    check (uber_price_cents is null or uber_price_cents >= 0);

-- ---------------------------------------------------------------------------
-- 6. RLS — admin-only for every new table. Pattern mirrors the existing
--    organization_members admin policies from 0008_roles_and_invitations.sql.
-- ---------------------------------------------------------------------------
alter table public.margin_assumptions    enable row level security;
alter table public.ingredients           enable row level security;
alter table public.product_recipe_lines  enable row level security;
alter table public.fixed_costs           enable row level security;

drop policy if exists margin_assumptions_admin   on public.margin_assumptions;
drop policy if exists ingredients_admin          on public.ingredients;
drop policy if exists product_recipe_lines_admin on public.product_recipe_lines;
drop policy if exists fixed_costs_admin          on public.fixed_costs;

create policy margin_assumptions_admin on public.margin_assumptions
  for all
  using      (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

create policy ingredients_admin on public.ingredients
  for all
  using      (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

create policy product_recipe_lines_admin on public.product_recipe_lines
  for all
  using      (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

create policy fixed_costs_admin on public.fixed_costs
  for all
  using      (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 7. Seed default margin_assumptions row for every existing org. Subsequent
--    org creation should also insert a row — handled in the org-creation RPC
--    (or via trigger in a follow-up migration if needed).
-- ---------------------------------------------------------------------------
insert into public.margin_assumptions (org_id)
  select id from public.organizations
  on conflict (org_id) do nothing;
