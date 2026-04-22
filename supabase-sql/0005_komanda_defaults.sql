create or replace function public.set_komanda_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.current_org_id();
  end if;
  if new.opened_by_auth_user_id is null then
    new.opened_by_auth_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_komandas_defaults on public.komandas;
create trigger trg_komandas_defaults
  before insert on public.komandas
  for each row execute function public.set_komanda_defaults();

-- Same for komanda_items (org_id only).
create or replace function public.set_komanda_item_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_komanda_items_defaults on public.komanda_items;
create trigger trg_komanda_items_defaults
  before insert on public.komanda_items
  for each row execute function public.set_komanda_item_defaults();
