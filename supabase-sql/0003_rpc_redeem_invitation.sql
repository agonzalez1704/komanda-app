create or replace function public.redeem_invitation(p_token text)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_email      citext;
  v_member     public.organization_members%rowtype;
begin
  -- Caller must be signed in.
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Fetch auth.users.email for the caller.
  select email::citext into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'no_email_on_account';
  end if;

  -- Look up invitation.
  select * into v_invitation from public.invitations where token = p_token for update;
  if not found then
    raise exception 'invitation_not_found';
  end if;
  if v_invitation.accepted_at is not null then
    raise exception 'invitation_already_redeemed';
  end if;
  if v_invitation.expires_at < now() then
    raise exception 'invitation_expired';
  end if;
  if v_invitation.email <> v_email then
    raise exception 'invitation_email_mismatch';
  end if;

  -- Create membership. Unique(auth_user_id) enforces one org per user for v1.
  insert into public.organization_members (auth_user_id, org_id, role, display_name)
  values (
    auth.uid(),
    v_invitation.org_id,
    v_invitation.role,
    coalesce(split_part(v_email::text, '@', 1), 'Member')
  )
  returning * into v_member;

  -- Mark invitation accepted.
  update public.invitations set accepted_at = now() where id = v_invitation.id;

  return v_member;
end;
$$;

-- Anyone signed in can call it (the function itself validates the token).
grant execute on function public.redeem_invitation(text) to authenticated;
