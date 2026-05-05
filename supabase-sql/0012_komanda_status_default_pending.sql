-- 0012_komanda_status_default_pending.sql
-- Promote 'pending' as the canonical initial state for komandas.
--
-- Background: a komanda created by a waiter is by definition awaiting the
-- kitchen. The legacy 'open' bucket conflated "just created" with "in
-- progress" which left waiters guessing what tables still hadn't been
-- served. Splitting the lifecycle so the default is 'pending' makes the
-- list scannable at a glance.
--
-- New canonical lifecycle:
--   pending → served (waiter delivered)
--   served  → pending (table ordered more)
--   served  → closed (paid)
-- 'open' stays in the check constraint as an accepted-but-deprecated value
-- so historical rows keep parsing; new writes never use it.

-- 1. Backfill any 'open' rows still around to 'pending'. Idempotent: a
--    second run finds nothing to update.
update public.komandas
   set status = 'pending'
 where status = 'open';

-- 2. Flip the column default. Inserts that don't specify status now land
--    in 'pending' instead of 'open'.
alter table public.komandas
  alter column status set default 'pending';
