create or replace function public.create_organization_and_member(
  p_name text,
  p_display_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required';
  end if;

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'display_name_required';
  end if;

  if exists (select 1 from public.organization_members where auth_user_id = v_uid) then
    raise exception 'already_member';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning id into v_org_id;

  insert into public.organization_members (auth_user_id, org_id, role, display_name)
  values (v_uid, v_org_id, 'admin', trim(p_display_name));

  return v_org_id;
end;
$$;

grant execute on function public.create_organization_and_member(text, text) to authenticated;
