-- SECURITY DEFINER helper to look up the caller's org without recursing through RLS.
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id
  from public.organization_members
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_org_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.organization_members
  where auth_user_id = auth.uid()
  limit 1
$$;

-- Enable RLS on every business table.
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.invitations           enable row level security;
alter table public.products              enable row level security;
alter table public.variants              enable row level security;
alter table public.modifiers             enable row level security;
alter table public.komandas              enable row level security;
alter table public.komanda_items         enable row level security;
alter table public.komanda_item_modifiers enable row level security;
alter table public.komanda_counters      enable row level security;

-- organizations: a user can read their own org.
create policy organizations_select on public.organizations
  for select using (id = public.current_org_id());

-- organization_members: user sees memberships in their own org.
create policy organization_members_select on public.organization_members
  for select using (org_id = public.current_org_id());

-- invitations: only org admins read/insert/delete.
create policy invitations_select_admin on public.invitations
  for select using (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );
create policy invitations_write_admin on public.invitations
  for insert with check (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );
create policy invitations_delete_admin on public.invitations
  for delete using (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );

-- Menu tables: any org member reads; only admins write.
create policy products_select on public.products
  for select using (org_id = public.current_org_id());
create policy products_write_admin on public.products
  for all
  using (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

create policy variants_select on public.variants
  for select using (org_id = public.current_org_id());
create policy variants_write_admin on public.variants
  for all
  using (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

create policy modifiers_select on public.modifiers
  for select using (org_id = public.current_org_id());
create policy modifiers_write_admin on public.modifiers
  for all
  using (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

-- Komanda tables: all org members read AND write.
create policy komandas_all on public.komandas
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy komanda_items_all on public.komanda_items
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- komanda_item_modifiers: inherit via parent komanda_items.
create policy komanda_item_modifiers_all on public.komanda_item_modifiers
  for all
  using (
    exists (
      select 1 from public.komanda_items ki
      where ki.id = komanda_item_id and ki.org_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.komanda_items ki
      where ki.id = komanda_item_id and ki.org_id = public.current_org_id()
    )
  );

-- komanda_counters: rows are managed only by the RPC; deny direct access.
create policy komanda_counters_none on public.komanda_counters
  for all using (false) with check (false);
