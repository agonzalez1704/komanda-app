create or replace function public.next_komanda_number(p_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org  uuid;
  v_num  integer;
begin
  v_org := public.current_org_id();
  if v_org is null then
    raise exception 'no_active_org';
  end if;

  insert into public.komanda_counters (org_id, date, last_number)
  values (v_org, p_date, 1)
  on conflict (org_id, date)
  do update set last_number = public.komanda_counters.last_number + 1
  returning last_number into v_num;

  return format('komanda-%s-%s',
    to_char(p_date, 'YYYYMMDD'),
    lpad(v_num::text, 3, '0'));
end;
$$;

grant execute on function public.next_komanda_number(date) to authenticated;
