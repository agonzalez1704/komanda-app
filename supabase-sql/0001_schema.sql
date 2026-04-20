-- Enable required extensions (idempotent).
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Organizations = tenants.
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Links an auth.users row to an organization. Also the app-side profile.
-- v1 constraint: one org per user (unique on auth_user_id).
create table if not exists public.organization_members (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  role          text not null check (role in ('admin','member')),
  display_name  text not null,
  created_at    timestamptz not null default now(),
  unique (auth_user_id),
  unique (auth_user_id, org_id)
);

create index if not exists organization_members_org_id_idx on public.organization_members(org_id);

-- Invitations issued by admins, redeemed by new users on sign-up.
create table if not exists public.invitations (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  email                    citext not null,
  role                     text not null check (role in ('admin','member')),
  token                    text not null unique,
  expires_at               timestamptz not null,
  accepted_at              timestamptz,
  created_by_auth_user_id  uuid not null references auth.users(id),
  created_at               timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations(email);
create index if not exists invitations_org_id_idx on public.invitations(org_id);

-- Menu: products + variants (labels only) + modifiers.
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  category     text not null default 'Uncategorized',
  price_cents  integer not null check (price_cents >= 0),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists products_org_id_idx on public.products(org_id);

create table if not exists public.variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0
);
create index if not exists variants_product_id_idx on public.variants(product_id);
create index if not exists variants_org_id_idx on public.variants(org_id);

create table if not exists public.modifiers (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references public.organizations(id) on delete cascade,
  name    text not null,
  active  boolean not null default true
);
create index if not exists modifiers_org_id_idx on public.modifiers(org_id);

-- Komandas + items + item-modifier join.
create table if not exists public.komandas (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  number                   text,
  display_name             text,
  status                   text not null default 'open' check (status in ('open','pending','served','closed')),
  opened_by_auth_user_id   uuid not null references auth.users(id),
  opened_at                timestamptz not null default now(),
  closed_at                timestamptz,
  closed_by_auth_user_id   uuid references auth.users(id),
  payment_method           text check (payment_method in ('cash','card','transfer')),
  total_cents              integer,
  local_uuid               uuid not null unique
);
create index if not exists komandas_org_id_idx on public.komandas(org_id);
create index if not exists komandas_opened_at_idx on public.komandas(opened_at desc);

create table if not exists public.komanda_items (
  id                      uuid primary key default gen_random_uuid(),
  komanda_id              uuid not null references public.komandas(id) on delete cascade,
  org_id                  uuid not null references public.organizations(id) on delete cascade,
  product_id              uuid references public.products(id),
  variant_id              uuid references public.variants(id),
  quantity                integer not null check (quantity > 0),
  unit_price_cents        integer not null check (unit_price_cents >= 0),
  product_name_snapshot   text not null,
  variant_name_snapshot   text,
  note_text               text,
  created_at              timestamptz not null default now()
);
create index if not exists komanda_items_komanda_id_idx on public.komanda_items(komanda_id);
create index if not exists komanda_items_org_id_idx on public.komanda_items(org_id);

create table if not exists public.komanda_item_modifiers (
  id               uuid primary key default gen_random_uuid(),
  komanda_item_id  uuid not null references public.komanda_items(id) on delete cascade,
  modifier_id      uuid references public.modifiers(id),
  name_snapshot    text not null
);
create index if not exists komanda_item_modifiers_item_id_idx on public.komanda_item_modifiers(komanda_item_id);

-- Per-org per-day counter.
create table if not exists public.komanda_counters (
  org_id       uuid not null references public.organizations(id) on delete cascade,
  date         date not null,
  last_number  integer not null default 0,
  primary key (org_id, date)
);
