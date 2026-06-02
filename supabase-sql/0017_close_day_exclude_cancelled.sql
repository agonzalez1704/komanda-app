-- 0017_close_day_exclude_cancelled.sql
-- Patch close_day to treat cancelled komandas as terminal — they should not
-- block the close. The original guard used `status <> 'closed'`, which
-- counted every non-closed status (including cancelled) as "still open".

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

  select role into v_role
    from public.organization_members
    where auth_user_id = v_uid and org_id = p_org_id
    limit 1;

  if v_role is null or v_role not in ('admin','cashier') then
    raise exception 'forbidden';
  end if;

  select * into v_open
    from public.audit_periods
    where org_id = p_org_id and status = 'open'
    for update;

  if not found then
    raise exception 'no_open_period';
  end if;

  -- Only count rows that are neither closed nor cancelled.
  select count(*) into v_open_count
    from public.komandas
    where period_id = v_open.id
      and status not in ('closed', 'cancelled');

  if v_open_count > 0 then
    raise exception 'open_komandas:%', v_open_count;
  end if;

  update public.audit_periods
    set status                 = 'closed',
        closed_at              = now(),
        closed_by_auth_user_id = v_uid
    where id = v_open.id
    returning * into v_open;

  insert into public.audit_periods (org_id, status, opened_at, opened_by_auth_user_id)
  values (p_org_id, 'open', now(), v_uid);

  return v_open;
end;
$$;

grant execute on function public.close_day(uuid) to authenticated;
