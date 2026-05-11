-- 0015_komanda_cancellation.sql
-- Komanda cancellation: a waiter can cancel a non-closed komanda from
-- the main list. Cancellation is an audited soft-state — the row stays
-- visible (status='cancelled') with a required note so audit can see who
-- cancelled what and why. Closed komandas cannot be cancelled.

alter table public.komandas
  drop constraint if exists komandas_status_check;

alter table public.komandas
  add constraint komandas_status_check
    check (status in ('open','pending','served','closed','cancelled'));

alter table public.komandas
  add column if not exists cancelled_at               timestamptz,
  add column if not exists cancelled_by_auth_user_id  uuid references auth.users(id),
  add column if not exists cancellation_note          text;

-- Cancelled rows must carry the audit trio; non-cancelled must not.
alter table public.komandas
  drop constraint if exists komandas_cancellation_chk;
alter table public.komandas
  add constraint komandas_cancellation_chk check (
    (status <> 'cancelled'
      and cancelled_at is null
      and cancelled_by_auth_user_id is null
      and cancellation_note is null)
    or (status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by_auth_user_id is not null
      and cancellation_note is not null
      and length(btrim(cancellation_note)) > 0)
  );
