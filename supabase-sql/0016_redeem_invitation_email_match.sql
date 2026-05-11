-- 0016_redeem_invitation_email_match.sql
-- Re-add the email-match check to redeem_invitation. The invitation is
-- pinned to the email the inviter typed; only an authed user whose
-- account matches that email may redeem. Closes the gap where a user
-- could sign up as a different email and still consume the invite.

create or replace function public.redeem_invitation(p_token text, p_display_name text default null)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text;
  v_invitation public.invitations%rowtype;
  v_member     public.organization_members%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invitation
    from public.invitations
    where token = p_token
    for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if v_invitation.expires_at < now() then
    update public.invitations
      set status = 'expired'
      where id = v_invitation.id;
    raise exception 'invitation_expired';
  end if;

  if lower(btrim(v_invitation.email::text)) <> lower(btrim(v_email)) then
    raise exception 'invitation_email_mismatch';
  end if;

  if exists (
    select 1 from public.organization_members
    where auth_user_id = v_uid and org_id = v_invitation.org_id
  ) then
    raise exception 'already_member';
  end if;

  begin
    insert into public.organization_members (auth_user_id, org_id, role, display_name)
    values (
      v_uid,
      v_invitation.org_id,
      v_invitation.role,
      coalesce(nullif(trim(p_display_name), ''), v_invitation.email::text)
    )
    returning * into v_member;
  exception when unique_violation then
    raise exception 'already_member';
  end;

  update public.invitations
    set status                   = 'accepted',
        accepted_at              = now(),
        accepted_by_auth_user_id = v_uid
    where id = v_invitation.id;

  return v_member;
end;
$$;

grant execute on function public.redeem_invitation(text, text) to authenticated;

-- Extend lookup_invitation with the inviter's email so the accept screen
-- can render a "Contact admin" mailto recovery action for revoked / used
-- / expired invites. Inviter email is the only PII surfaced (and it's
-- already known to whoever holds the token).
create or replace function public.lookup_invitation(p_token text)
returns table (
  org_id        uuid,
  org_name      text,
  role          text,
  email         text,
  status        text,
  expires_at    timestamptz,
  inviter_email text
)
language sql
security definer
set search_path = public
as $$
  select i.org_id,
         o.name        as org_name,
         i.role,
         i.email::text as email,
         i.status,
         i.expires_at,
         u.email::text as inviter_email
    from public.invitations i
    join public.organizations o on o.id = i.org_id
    left join auth.users u on u.id = i.created_by_auth_user_id
    where i.token = p_token
    limit 1;
$$;

grant execute on function public.lookup_invitation(text) to anon, authenticated;
