-- 0013_komanda_audit_and_realtime.sql
-- Komanda audit columns + realtime broadcast on creation.
--
-- Two pieces:
--   1. updated_at + updated_by_auth_user_id on public.komandas, kept fresh
--      by a BEFORE INSERT/UPDATE trigger that reads auth.uid() — no app
--      code changes needed; every write through RLS-authenticated channels
--      will set the columns automatically.
--   2. A realtime channel pattern `org:%:komandas` and an AFTER INSERT
--      trigger that publishes the new row. Subscribers receive a payload
--      with id, org_id, opened_by_auth_user_id, display_name, opened_at —
--      enough to render a notification + deep link to /komandas/[id].

-- ────────────────────────────────────────────────────────────────────────
-- 1. Audit columns
-- ────────────────────────────────────────────────────────────────────────

alter table public.komandas
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by_auth_user_id uuid references auth.users(id);

create index if not exists komandas_updated_at_idx
  on public.komandas(org_id, updated_at desc);

-- Backfill: existing rows get updated_at = opened_at (best approximation),
-- updated_by = opened_by. Idempotent.
update public.komandas
   set updated_at = coalesce(updated_at, opened_at),
       updated_by_auth_user_id = coalesce(updated_by_auth_user_id, opened_by_auth_user_id)
 where updated_at is null
    or updated_by_auth_user_id is null;

-- Trigger: every insert/update stamps updated_at = now() and
-- updated_by_auth_user_id = auth.uid(). When called from a SECURITY
-- DEFINER context (RPC) auth.uid() is still the calling user.
create or replace function public.tg_komandas_set_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  -- auth.uid() can be null in service-role contexts; only override when
  -- we actually have a user id, otherwise preserve whatever the caller
  -- supplied.
  if auth.uid() is not null then
    new.updated_by_auth_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists komandas_set_audit on public.komandas;
create trigger komandas_set_audit
  before insert or update on public.komandas
  for each row
  execute function public.tg_komandas_set_audit();

-- ────────────────────────────────────────────────────────────────────────
-- 2. Realtime channel + insert broadcast
-- ────────────────────────────────────────────────────────────────────────

-- Register the channel pattern. `%` is the wildcard for org_id so a single
-- pattern covers every tenant. Idempotent insert.
insert into realtime.channels (pattern, description, enabled)
values ('org:%:komandas', 'Komanda lifecycle events per org', true)
on conflict (pattern) do update
  set enabled = excluded.enabled,
      description = excluded.description;

-- Broadcast on create. Subscribers (the mobile app) receive
-- event 'created' with a JSON payload they can render directly.
create or replace function public.tg_komandas_publish_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.publish(
    'org:' || new.org_id::text || ':komandas',
    'created',
    jsonb_build_object(
      'id', new.id,
      'org_id', new.org_id,
      'opened_by_auth_user_id', new.opened_by_auth_user_id,
      'display_name', new.display_name,
      'number', new.number,
      'opened_at', new.opened_at
    )
  );
  return new;
end;
$$;

drop trigger if exists komandas_publish_created on public.komandas;
create trigger komandas_publish_created
  after insert on public.komandas
  for each row
  execute function public.tg_komandas_publish_created();
