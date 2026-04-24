create or replace function public.set_menu_defaults()
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

drop trigger if exists trg_products_defaults on public.products;
create trigger trg_products_defaults
  before insert on public.products
  for each row execute function public.set_menu_defaults();

drop trigger if exists trg_variants_defaults on public.variants;
create trigger trg_variants_defaults
  before insert on public.variants
  for each row execute function public.set_menu_defaults();

drop trigger if exists trg_modifiers_defaults on public.modifiers;
create trigger trg_modifiers_defaults
  before insert on public.modifiers
  for each row execute function public.set_menu_defaults();
