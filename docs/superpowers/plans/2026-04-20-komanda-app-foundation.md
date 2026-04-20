# Komanda App — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a signed-in, org-scoped, offline-capable shell of the komanda-app — enough that a waiter can install, accept an invite, sign in, and land on an empty komandas screen that reads menu data from Insforge and survives wifi dropouts.

**Architecture:** Expo (expo-router) → `@insforge/sdk` directly, with TanStack Query + AsyncStorage for cache persistence and a custom mutation queue for offline writes. Multi-tenancy via our own `organizations` / `organization_members` / `invitations` tables backed by Insforge RLS.

**Tech Stack:** Expo 54, expo-router 6, React 19, `@insforge/sdk`, `@tanstack/react-query` + `@tanstack/query-async-storage-persister` + `@tanstack/react-query-persist-client`, `zustand`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `expo-linking`, `zod`, `nanoid/non-secure`.

**Companion spec:** [docs/superpowers/specs/2026-04-18-komanda-app-v1-design.md](../specs/2026-04-18-komanda-app-v1-design.md)

---

## File Structure

Files this plan creates or modifies:

```
app/
  _layout.tsx                            -- MODIFY: add providers + auth gate
  (auth)/
    _layout.tsx                          -- NEW: stack for auth screens
    sign-in.tsx                          -- NEW
    sign-up.tsx                          -- NEW
    no-org.tsx                           -- NEW
  (app)/
    _layout.tsx                          -- NEW: auth + membership guard
    komandas/index.tsx                   -- NEW (minimal placeholder; real UI in Plan B)
    settings.tsx                         -- NEW (profile + sign out only)
src/
  env.ts                                 -- NEW: validated env loader
  insforge/client.ts                     -- NEW: single Insforge client instance
  insforge/session.ts                    -- NEW: session hook + reactive state
  insforge/schemas.ts                    -- NEW: zod row schemas
  insforge/queries/membership.ts         -- NEW: membership lookup
  insforge/queries/menu.ts               -- NEW: products/variants/modifiers reads
  insforge/queries/invitations.ts        -- NEW: redeem_invitation RPC caller
  offline/queue.ts                       -- NEW: typed mutation queue core
  offline/processor.ts                   -- NEW: queue drainer + retry logic
  offline/network.ts                     -- NEW: NetInfo hook
  offline/QueryProvider.tsx              -- NEW: TanStack Query client + persistence
  components/OfflineBanner.tsx           -- NEW: top banner when offline
supabase-sql/                            -- NEW directory (schema SQL for Insforge)
  0001_schema.sql                        -- NEW: organizations, members, invitations, products, komandas, etc.
  0002_rls.sql                           -- NEW: RLS policies + security-definer helpers
  0003_rpc_redeem_invitation.sql         -- NEW: redeem_invitation function
  0004_rpc_next_komanda_number.sql       -- NEW: counter RPC (used by Plan B but defined here)
tests/
  setup.ts                               -- NEW: Jest + @testing-library/react-native config
  offline/queue.test.ts                  -- NEW
  offline/processor.test.ts              -- NEW
  insforge/schemas.test.ts               -- NEW
.env.example                             -- NEW
app.json                                 -- MODIFY: add scheme + deep-link config
package.json                             -- MODIFY: add scripts + deps
jest.config.js                           -- NEW
tsconfig.json                            -- MODIFY: add `src/*` path alias
eslint.config.js                         -- MODIFY: include src + tests
```

Files **removed** (demo scaffold from `create-expo-app`):

```
app/(tabs)/_layout.tsx
app/(tabs)/explore.tsx
app/(tabs)/index.tsx
app/modal.tsx
components/external-link.tsx
components/hello-wave.tsx
components/parallax-scroll-view.tsx
components/haptic-tab.tsx
components/themed-text.tsx
components/themed-view.tsx
components/ui/                           -- entire directory
hooks/use-color-scheme.ts
hooks/use-color-scheme.web.ts
hooks/use-theme-color.ts
constants/theme.ts
scripts/reset-project.js
```

---

## Task 1: Strip Expo demo scaffold and wire empty root layout

**Files:**
- Delete: `app/(tabs)/`, `app/modal.tsx`, `components/`, `hooks/`, `constants/`, `scripts/`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Delete scaffolded demo files**

```bash
rm -rf app/\(tabs\) app/modal.tsx components hooks constants scripts
```

- [ ] **Step 2: Replace `app/_layout.tsx` with a bare stack**

File: `app/_layout.tsx`

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
```

- [ ] **Step 3: Create `app/(auth)/_layout.tsx` and `app/(app)/_layout.tsx` placeholders**

File: `app/(auth)/_layout.tsx`

```tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

File: `app/(app)/_layout.tsx`

```tsx
import { Stack } from 'expo-router';
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Also create minimal placeholder screens so expo-router has something to render:

File: `app/(auth)/sign-in.tsx`

```tsx
import { Text, View } from 'react-native';
export default function SignIn() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>sign-in (placeholder)</Text>
    </View>
  );
}
```

File: `app/(app)/komandas/index.tsx`

```tsx
import { Text, View } from 'react-native';
export default function Komandas() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>komandas (placeholder)</Text>
    </View>
  );
}
```

- [ ] **Step 4: Run the app to verify it boots**

Run: `npx expo start --ios`
Expected: app opens, shows the sign-in placeholder text. No crashes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: strip expo demo scaffold, add empty route groups"
```

---

## Task 2: Add TypeScript path alias and install core dependencies

**Files:**
- Modify: `tsconfig.json`
- Modify: `package.json` (via `npx expo install` commands)

- [ ] **Step 1: Add `src/*` path alias to `tsconfig.json`**

File: `tsconfig.json` — replace with:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

- [ ] **Step 2: Install runtime dependencies**

Run:
```bash
npx expo install @insforge/sdk @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister @react-native-async-storage/async-storage @react-native-community/netinfo zustand expo-linking zod nanoid
```

Expected: installs succeed, `package.json` updated.

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
npm i -D jest @types/jest jest-expo @testing-library/react-native @testing-library/jest-native react-test-renderer@19.1.0
```

Expected: installs succeed.

- [ ] **Step 4: Verify no type errors in the empty project**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: add src alias and install core dependencies"
```

---

## Task 3: Configure Jest and write a trivial sanity test

**Files:**
- Create: `jest.config.js`
- Create: `tests/setup.ts`
- Create: `tests/sanity.test.ts`
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Write `jest.config.js`**

File: `jest.config.js`

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack|nanoid|@insforge|zustand))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/.expo/'],
};
```

- [ ] **Step 2: Write `tests/setup.ts`**

File: `tests/setup.ts`

```ts
import '@testing-library/jest-native/extend-expect';
```

- [ ] **Step 3: Add the `test` script**

Modify `package.json` scripts section to include:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Write a sanity test**

File: `tests/sanity.test.ts`

```ts
describe('sanity', () => {
  it('adds 2 + 2', () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npm test`
Expected: 1 passed, 1 total.

- [ ] **Step 6: Commit**

```bash
git add jest.config.js tests/ package.json package-lock.json
git commit -m "chore: configure jest with jest-expo preset"
```

---

## Task 4: Insforge SQL schema (business tables only)

The business tables are created independently of RLS in this task; RLS is added in Task 5. This isolates the schema change from the policy change for easier review.

**Files:**
- Create: `supabase-sql/0001_schema.sql`

- [ ] **Step 1: Write the full schema SQL**

File: `supabase-sql/0001_schema.sql`

```sql
-- Enable required extensions (idempotent).
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Organizations = tenants.
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Links an auth.users row to an organization. Also the app-side profile.
-- v1 constraint: one org per user (unique on auth_user_id).
create table if not exists public.organization_members (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  role          text not null check (role in ('admin','member')),
  display_name  text not null,
  created_at    timestamptz not null default now(),
  unique (auth_user_id),
  unique (auth_user_id, org_id)
);

create index if not exists organization_members_org_id_idx on public.organization_members(org_id);

-- Invitations issued by admins, redeemed by new users on sign-up.
create table if not exists public.invitations (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  email                    citext not null,
  role                     text not null check (role in ('admin','member')),
  token                    text not null unique,
  expires_at               timestamptz not null,
  accepted_at              timestamptz,
  created_by_auth_user_id  uuid not null references auth.users(id),
  created_at               timestamptz not null default now()
);

create index if not exists invitations_email_idx on public.invitations(email);
create index if not exists invitations_org_id_idx on public.invitations(org_id);

-- Menu: products + variants (labels only) + modifiers.
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  category     text not null default 'Uncategorized',
  price_cents  integer not null check (price_cents >= 0),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists products_org_id_idx on public.products(org_id);

create table if not exists public.variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0
);
create index if not exists variants_product_id_idx on public.variants(product_id);
create index if not exists variants_org_id_idx on public.variants(org_id);

create table if not exists public.modifiers (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references public.organizations(id) on delete cascade,
  name    text not null,
  active  boolean not null default true
);
create index if not exists modifiers_org_id_idx on public.modifiers(org_id);

-- Komandas + items + item-modifier join.
create table if not exists public.komandas (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  number                   text,                   -- null until synced
  display_name             text,
  status                   text not null default 'open' check (status in ('open','pending','served','closed')),
  opened_by_auth_user_id   uuid not null references auth.users(id),
  opened_at                timestamptz not null default now(),
  closed_at                timestamptz,
  closed_by_auth_user_id   uuid references auth.users(id),
  payment_method           text check (payment_method in ('cash','card','transfer')),
  total_cents              integer,
  local_uuid               uuid not null unique
);
create index if not exists komandas_org_id_idx on public.komandas(org_id);
create index if not exists komandas_opened_at_idx on public.komandas(opened_at desc);

create table if not exists public.komanda_items (
  id                      uuid primary key default gen_random_uuid(),
  komanda_id              uuid not null references public.komandas(id) on delete cascade,
  org_id                  uuid not null references public.organizations(id) on delete cascade,
  product_id              uuid references public.products(id),
  variant_id              uuid references public.variants(id),
  quantity                integer not null check (quantity > 0),
  unit_price_cents        integer not null check (unit_price_cents >= 0),
  product_name_snapshot   text not null,
  variant_name_snapshot   text,
  note_text               text,
  created_at              timestamptz not null default now()
);
create index if not exists komanda_items_komanda_id_idx on public.komanda_items(komanda_id);
create index if not exists komanda_items_org_id_idx on public.komanda_items(org_id);

create table if not exists public.komanda_item_modifiers (
  id               uuid primary key default gen_random_uuid(),
  komanda_item_id  uuid not null references public.komanda_items(id) on delete cascade,
  modifier_id      uuid references public.modifiers(id),
  name_snapshot    text not null
);
create index if not exists komanda_item_modifiers_item_id_idx on public.komanda_item_modifiers(komanda_item_id);

-- Per-org per-day counter.
create table if not exists public.komanda_counters (
  org_id       uuid not null references public.organizations(id) on delete cascade,
  date         date not null,
  last_number  integer not null default 0,
  primary key (org_id, date)
);
```

- [ ] **Step 2: Apply the migration to the Insforge project**

Run:
```bash
npx @insforge/cli db execute --file supabase-sql/0001_schema.sql
```

(If the exact CLI command differs, check `npx @insforge/cli --help` and use the "execute SQL" subcommand. The user's project is already linked — see `../komanda/.insforge/project.json`.)

Expected: SQL applies without errors. Verify with `npx @insforge/cli db list-tables` or similar.

- [ ] **Step 3: Commit**

```bash
git add supabase-sql/0001_schema.sql
git commit -m "feat(db): initial schema for orgs, menu, komandas"
```

---

## Task 5: Insforge RLS policies

**Files:**
- Create: `supabase-sql/0002_rls.sql`

RLS policies must read membership via a `SECURITY DEFINER` helper to avoid recursive RLS on `organization_members` itself (documented failure mode; see `.windsurf/skills/insforge/database/postgres-rls.md` in the sibling project).

- [ ] **Step 1: Write the RLS SQL**

File: `supabase-sql/0002_rls.sql`

```sql
-- SECURITY DEFINER helper to look up the caller's org without recursing through RLS.
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id
  from public.organization_members
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_org_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.organization_members
  where auth_user_id = auth.uid()
  limit 1
$$;

-- Enable RLS on every business table.
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.invitations           enable row level security;
alter table public.products              enable row level security;
alter table public.variants              enable row level security;
alter table public.modifiers             enable row level security;
alter table public.komandas              enable row level security;
alter table public.komanda_items         enable row level security;
alter table public.komanda_item_modifiers enable row level security;
alter table public.komanda_counters      enable row level security;

-- organizations: a user can read their own org.
create policy organizations_select on public.organizations
  for select using (id = public.current_org_id());

-- organization_members: user sees memberships in their own org (covers themselves).
create policy organization_members_select on public.organization_members
  for select using (org_id = public.current_org_id());
-- Inserts into organization_members happen via the redeem_invitation RPC (SECURITY DEFINER),
-- so no INSERT policy is granted to the caller here.

-- invitations: only org admins read/insert/delete. (Mobile app doesn't write these in v1,
-- but the Next.js dashboard will; these policies make both safe.)
create policy invitations_select_admin on public.invitations
  for select using (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );
create policy invitations_write_admin on public.invitations
  for insert with check (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );
create policy invitations_delete_admin on public.invitations
  for delete using (
    org_id = public.current_org_id() and public.current_org_role() = 'admin'
  );

-- Menu tables: any org member reads; only admins write.
-- (Mobile app is read-only in v1; admin writes happen from the Next.js dashboard.)
create policy products_select on public.products
  for select using (org_id = public.current_org_id());
create policy products_write_admin on public.products
  for all
  using (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

create policy variants_select on public.variants
  for select using (org_id = public.current_org_id());
create policy variants_write_admin on public.variants
  for all
  using (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

create policy modifiers_select on public.modifiers
  for select using (org_id = public.current_org_id());
create policy modifiers_write_admin on public.modifiers
  for all
  using (org_id = public.current_org_id() and public.current_org_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_org_role() = 'admin');

-- Komanda tables: all org members read AND write.
create policy komandas_all on public.komandas
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy komanda_items_all on public.komanda_items
  for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- komanda_item_modifiers: inherit via parent komanda_items via join.
create policy komanda_item_modifiers_all on public.komanda_item_modifiers
  for all
  using (
    exists (
      select 1 from public.komanda_items ki
      where ki.id = komanda_item_id and ki.org_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.komanda_items ki
      where ki.id = komanda_item_id and ki.org_id = public.current_org_id()
    )
  );

-- komanda_counters: rows are managed only by the RPC; deny direct access.
create policy komanda_counters_none on public.komanda_counters
  for all using (false) with check (false);
```

- [ ] **Step 2: Apply the RLS migration**

Run: `npx @insforge/cli db execute --file supabase-sql/0002_rls.sql`
Expected: SQL applies without errors.

- [ ] **Step 3: Manually verify with two test users**

Create two test auth users (via Insforge dashboard or `insforge.auth.signUp` from a quick script), insert them into two different `organizations` + `organization_members`, and confirm each user's `select * from products` only returns their org's rows.

- [ ] **Step 4: Commit**

```bash
git add supabase-sql/0002_rls.sql
git commit -m "feat(db): RLS policies scoping all business tables by organization"
```

---

## Task 6: `redeem_invitation` RPC

Insforge SQL function that a newly signed-up user calls to claim their invite. `SECURITY DEFINER` so it can insert into `organization_members` even though the caller has no write policy there.

**Files:**
- Create: `supabase-sql/0003_rpc_redeem_invitation.sql`

- [ ] **Step 1: Write the RPC SQL**

File: `supabase-sql/0003_rpc_redeem_invitation.sql`

```sql
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
```

- [ ] **Step 2: Apply the RPC migration**

Run: `npx @insforge/cli db execute --file supabase-sql/0003_rpc_redeem_invitation.sql`
Expected: function created.

- [ ] **Step 3: Commit**

```bash
git add supabase-sql/0003_rpc_redeem_invitation.sql
git commit -m "feat(db): redeem_invitation RPC"
```

---

## Task 7: `next_komanda_number` RPC

Used by Plan B (`create_komanda` mutation) to atomically allocate the per-org per-day counter. Defined here so the backend is complete before Plan A ships.

**Files:**
- Create: `supabase-sql/0004_rpc_next_komanda_number.sql`

- [ ] **Step 1: Write the RPC SQL**

File: `supabase-sql/0004_rpc_next_komanda_number.sql`

```sql
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
```

- [ ] **Step 2: Apply migration**

Run: `npx @insforge/cli db execute --file supabase-sql/0004_rpc_next_komanda_number.sql`

- [ ] **Step 3: Commit**

```bash
git add supabase-sql/0004_rpc_next_komanda_number.sql
git commit -m "feat(db): next_komanda_number RPC (per-org per-day counter)"
```

---

## Task 8: Environment variable loader

**Files:**
- Create: `.env.example`
- Create: `src/env.ts`
- Modify: `.gitignore` (ensure `.env` ignored)
- Modify: `app.json` (register expo scheme for deep links)

- [ ] **Step 1: Write `.env.example`**

File: `.env.example`

```
EXPO_PUBLIC_INSFORGE_URL=https://sb8gjp94.us-east.insforge.app
EXPO_PUBLIC_INSFORGE_ANON_KEY=__paste_anon_key_here__
```

- [ ] **Step 2: Create a local `.env` (for development only)**

The real anon key is fetched via: `npx @insforge/cli secrets get ANON_KEY` (run from the sibling `komanda` project where the Insforge link is configured, or `npx @insforge/cli link` first).

```bash
# in komanda-app/
cp .env.example .env
# paste the actual key in .env
```

- [ ] **Step 3: Verify `.env` is gitignored**

Run: `grep -E '^\.env$|^\.env\.local$' .gitignore || echo MISSING`
Expected: both patterns present. If `MISSING`, append:

```
.env
.env.local
```

- [ ] **Step 4: Write `src/env.ts`**

File: `src/env.ts`

```ts
import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_INSFORGE_URL: z.string().url(),
  EXPO_PUBLIC_INSFORGE_ANON_KEY: z.string().min(20),
});

const parsed = schema.safeParse({
  EXPO_PUBLIC_INSFORGE_URL: process.env.EXPO_PUBLIC_INSFORGE_URL,
  EXPO_PUBLIC_INSFORGE_ANON_KEY: process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Invalid EXPO_PUBLIC_INSFORGE_* env vars:\n${parsed.error.toString()}`
  );
}

export const env = parsed.data;
```

- [ ] **Step 5: Register URL scheme in `app.json`**

Modify `app.json` — add or confirm `"scheme": "komanda"` at the top level of the `expo` object. Full example replacement of the `expo` object key-by-key is not needed; just ensure:

```json
{
  "expo": {
    "scheme": "komanda",
    ...
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add .env.example src/env.ts app.json .gitignore
git commit -m "feat: validated env loader + komanda:// URL scheme"
```

---

## Task 9: Insforge client + session hook

**Files:**
- Create: `src/insforge/client.ts`
- Create: `src/insforge/session.ts`

- [ ] **Step 1: Write the client**

File: `src/insforge/client.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@insforge/sdk';
import { env } from '@/env';

// Single shared client instance. The SDK persists its session to the provided
// storage adapter so reopening the app resumes the session.
export const insforge = createClient({
  baseUrl: env.EXPO_PUBLIC_INSFORGE_URL,
  anonKey: env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

> Note: exact `createClient` auth-config option names may vary; the engineer should confirm against the installed SDK version and adjust (e.g., the SDK may accept a flat `storage` option). Keep the behavior: AsyncStorage-backed session persistence + auto-refresh.

- [ ] **Step 2: Write the session hook**

File: `src/insforge/session.ts`

```ts
import { useEffect, useState } from 'react';
import { insforge } from './client';

export type Session = {
  userId: string;
  email: string;
  accessToken: string;
} | null;

/**
 * Reactive auth session. Returns `{ status: 'loading' }` until the SDK has
 * rehydrated any persisted session from AsyncStorage.
 */
export function useSession():
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: NonNullable<Session> } {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'signed-out' }
    | { status: 'signed-in'; session: NonNullable<Session> }
  >({ status: 'loading' });

  useEffect(() => {
    let mounted = true;

    const toState = (raw: unknown): typeof state => {
      // Shape-agnostic: accept any object with user/accessToken.
      const s = raw as null | {
        user?: { id?: string; email?: string };
        accessToken?: string;
      };
      if (!s || !s.user?.id || !s.user?.email || !s.accessToken) {
        return { status: 'signed-out' };
      }
      return {
        status: 'signed-in',
        session: { userId: s.user.id, email: s.user.email, accessToken: s.accessToken },
      };
    };

    insforge.auth.getSession().then((res: any) => {
      if (!mounted) return;
      setState(toState(res?.data ?? res ?? null));
    });

    const sub = insforge.auth.onAuthStateChange((_event: string, raw: unknown) => {
      if (!mounted) return;
      setState(toState(raw));
    });

    return () => {
      mounted = false;
      // SDK subscription cleanup; exact method may be sub.unsubscribe() or similar.
      (sub as any)?.data?.subscription?.unsubscribe?.();
      (sub as any)?.unsubscribe?.();
    };
  }, []);

  return state;
}
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/insforge/client.ts src/insforge/session.ts
git commit -m "feat(insforge): client singleton + reactive session hook"
```

---

## Task 10: Row schemas (zod)

**Files:**
- Create: `src/insforge/schemas.ts`
- Create: `tests/insforge/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/insforge/schemas.test.ts`

```ts
import {
  KomandaRow,
  OrganizationMemberRow,
  ProductRow,
  VariantRow,
  ModifierRow,
} from '@/insforge/schemas';

describe('KomandaRow', () => {
  it('accepts a well-formed row with null number', () => {
    const parsed = KomandaRow.parse({
      id: '11111111-1111-1111-1111-111111111111',
      org_id: '22222222-2222-2222-2222-222222222222',
      number: null,
      display_name: null,
      status: 'open',
      opened_by_auth_user_id: '33333333-3333-3333-3333-333333333333',
      opened_at: '2026-04-20T14:32:00.000Z',
      closed_at: null,
      closed_by_auth_user_id: null,
      payment_method: null,
      total_cents: null,
      local_uuid: '44444444-4444-4444-4444-444444444444',
    });
    expect(parsed.status).toBe('open');
  });

  it('rejects an unknown status', () => {
    expect(() => KomandaRow.parse({ status: 'exploded' })).toThrow();
  });
});

describe('OrganizationMemberRow', () => {
  it('accepts admin and member roles', () => {
    for (const role of ['admin', 'member'] as const) {
      expect(() =>
        OrganizationMemberRow.parse({
          id: '11111111-1111-1111-1111-111111111111',
          auth_user_id: '22222222-2222-2222-2222-222222222222',
          org_id: '33333333-3333-3333-3333-333333333333',
          role,
          display_name: 'Juan',
          created_at: '2026-04-20T00:00:00.000Z',
        })
      ).not.toThrow();
    }
  });
});

describe('ProductRow / VariantRow / ModifierRow', () => {
  it('parse active flags and integer prices', () => {
    ProductRow.parse({
      id: '11111111-1111-1111-1111-111111111111',
      org_id: '22222222-2222-2222-2222-222222222222',
      name: 'Taco',
      category: 'Tacos',
      price_cents: 2500,
      active: true,
      sort_order: 0,
      created_at: '2026-04-20T00:00:00.000Z',
    });
    VariantRow.parse({
      id: '11111111-1111-1111-1111-111111111111',
      product_id: '22222222-2222-2222-2222-222222222222',
      org_id: '33333333-3333-3333-3333-333333333333',
      name: 'pastor',
      active: true,
      sort_order: 0,
    });
    ModifierRow.parse({
      id: '11111111-1111-1111-1111-111111111111',
      org_id: '22222222-2222-2222-2222-222222222222',
      name: 'sin cebolla',
      active: true,
    });
  });
});
```

- [ ] **Step 2: Run the test to see it fails (module not found)**

Run: `npm test -- schemas`
Expected: FAIL — "Cannot find module '@/insforge/schemas'".

- [ ] **Step 3: Write the schemas**

File: `src/insforge/schemas.ts`

```ts
import { z } from 'zod';

const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true }).or(z.string()); // Insforge may return non-Z suffix

export const OrganizationRow = z.object({
  id: uuid,
  name: z.string(),
  created_at: iso,
});

export const OrganizationMemberRow = z.object({
  id: uuid,
  auth_user_id: uuid,
  org_id: uuid,
  role: z.enum(['admin', 'member']),
  display_name: z.string(),
  created_at: iso,
});

export const InvitationRow = z.object({
  id: uuid,
  org_id: uuid,
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
  token: z.string(),
  expires_at: iso,
  accepted_at: iso.nullable(),
  created_by_auth_user_id: uuid,
  created_at: iso,
});

export const ProductRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  category: z.string(),
  price_cents: z.number().int().nonnegative(),
  active: z.boolean(),
  sort_order: z.number().int(),
  created_at: iso,
});

export const VariantRow = z.object({
  id: uuid,
  product_id: uuid,
  org_id: uuid,
  name: z.string(),
  active: z.boolean(),
  sort_order: z.number().int(),
});

export const ModifierRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  active: z.boolean(),
});

export const KomandaStatus = z.enum(['open', 'pending', 'served', 'closed']);
export const PaymentMethod = z.enum(['cash', 'card', 'transfer']);

export const KomandaRow = z.object({
  id: uuid,
  org_id: uuid,
  number: z.string().nullable(),
  display_name: z.string().nullable(),
  status: KomandaStatus,
  opened_by_auth_user_id: uuid,
  opened_at: iso,
  closed_at: iso.nullable(),
  closed_by_auth_user_id: uuid.nullable(),
  payment_method: PaymentMethod.nullable(),
  total_cents: z.number().int().nullable(),
  local_uuid: uuid,
});

export type KomandaStatusT = z.infer<typeof KomandaStatus>;
export type PaymentMethodT = z.infer<typeof PaymentMethod>;
export type OrganizationMemberRowT = z.infer<typeof OrganizationMemberRow>;
export type ProductRowT = z.infer<typeof ProductRow>;
export type VariantRowT = z.infer<typeof VariantRow>;
export type ModifierRowT = z.infer<typeof ModifierRow>;
export type KomandaRowT = z.infer<typeof KomandaRow>;
```

- [ ] **Step 4: Run the test**

Run: `npm test -- schemas`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/insforge/schemas.ts tests/insforge/schemas.test.ts
git commit -m "feat(insforge): zod schemas for all row types"
```

---

## Task 11: Membership + menu query helpers

**Files:**
- Create: `src/insforge/queries/membership.ts`
- Create: `src/insforge/queries/menu.ts`
- Create: `src/insforge/queries/invitations.ts`

- [ ] **Step 1: Write `membership.ts`**

File: `src/insforge/queries/membership.ts`

```ts
import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, type OrganizationMemberRowT } from '@/insforge/schemas';

/**
 * Fetch the caller's single organization_members row.
 * Returns null if the user is signed in but has no membership (edge case).
 */
export async function fetchMyMembership(): Promise<OrganizationMemberRowT | null> {
  const { data, error } = await insforge
    .from('organization_members')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return OrganizationMemberRow.parse(data);
}
```

- [ ] **Step 2: Write `menu.ts`**

File: `src/insforge/queries/menu.ts`

```ts
import { insforge } from '@/insforge/client';
import {
  ProductRow,
  VariantRow,
  ModifierRow,
  type ProductRowT,
  type VariantRowT,
  type ModifierRowT,
} from '@/insforge/schemas';

export async function fetchProducts(): Promise<ProductRowT[]> {
  const { data, error } = await insforge
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ProductRow.parse(row));
}

export async function fetchVariants(): Promise<VariantRowT[]> {
  const { data, error } = await insforge
    .from('variants')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => VariantRow.parse(row));
}

export async function fetchModifiers(): Promise<ModifierRowT[]> {
  const { data, error } = await insforge
    .from('modifiers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ModifierRow.parse(row));
}
```

- [ ] **Step 3: Write `invitations.ts`**

File: `src/insforge/queries/invitations.ts`

```ts
import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, type OrganizationMemberRowT } from '@/insforge/schemas';

export async function redeemInvitation(token: string): Promise<OrganizationMemberRowT> {
  const { data, error } = await insforge.rpc('redeem_invitation', { p_token: token });
  if (error) throw error;
  return OrganizationMemberRow.parse(data);
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/insforge/queries/
git commit -m "feat(insforge): query helpers for membership, menu, invitation redeem"
```

---

## Task 12: Network status hook

**Files:**
- Create: `src/offline/network.ts`

- [ ] **Step 1: Write the hook**

File: `src/offline/network.ts`

```ts
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Reactive online/offline flag. `true` when reachable; `null` during first probe.
 */
export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const reachable =
        state.isInternetReachable ?? state.isConnected ?? false;
      setOnline(Boolean(reachable));
    });
    NetInfo.fetch().then((state) => {
      setOnline(Boolean(state.isInternetReachable ?? state.isConnected ?? false));
    });
    return () => sub();
  }, []);

  return online;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/offline/network.ts
git commit -m "feat(offline): NetInfo-backed useOnline hook"
```

---

## Task 13: Offline mutation queue — types and persistence

**Files:**
- Create: `src/offline/queue.ts`
- Create: `tests/offline/queue.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/offline/queue.test.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueueStore,
  enqueue,
  dequeue,
  markFailed,
  getAll,
  QUEUE_STORAGE_KEY,
} from '@/offline/queue';

// jest-expo preset includes the AsyncStorage mock.
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('mutation queue', () => {
  it('enqueues and persists a mutation', async () => {
    const store = createQueueStore();
    await enqueue(store, { type: 'create_komanda', payload: { local_uuid: 'a' } });

    const persisted = JSON.parse((await AsyncStorage.getItem(QUEUE_STORAGE_KEY)) ?? '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].type).toBe('create_komanda');
    expect(persisted[0].id).toBeDefined();
    expect(persisted[0].attemptCount).toBe(0);
  });

  it('dequeues by id', async () => {
    const store = createQueueStore();
    const m = await enqueue(store, { type: 'create_komanda', payload: { local_uuid: 'a' } });
    await dequeue(store, m.id);
    expect(await getAll(store)).toEqual([]);
  });

  it('markFailed increments attemptCount and records error', async () => {
    const store = createQueueStore();
    const m = await enqueue(store, { type: 'create_komanda', payload: { local_uuid: 'a' } });
    await markFailed(store, m.id, 'boom');
    const [persisted] = await getAll(store);
    expect(persisted.attemptCount).toBe(1);
    expect(persisted.lastError).toBe('boom');
  });

  it('rehydrates from AsyncStorage on creation', async () => {
    await AsyncStorage.setItem(
      QUEUE_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'x',
          type: 'create_komanda',
          payload: { local_uuid: 'y' },
          createdAt: '2026-04-20T00:00:00.000Z',
          attemptCount: 2,
          lastError: null,
        },
      ])
    );
    const store = createQueueStore();
    // Wait for the async rehydrate cycle.
    await new Promise((r) => setTimeout(r, 0));
    const all = await getAll(store);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('x');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- queue.test`
Expected: FAIL — "Cannot find module '@/offline/queue'".

- [ ] **Step 3: Write the queue module**

File: `src/offline/queue.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid/non-secure';

export const QUEUE_STORAGE_KEY = '@komanda/mutation-queue/v1';

export type MutationType =
  | 'create_komanda'
  | 'rename_komanda'
  | 'update_status'
  | 'add_item'
  | 'update_item'
  | 'remove_item'
  | 'close_komanda';

export interface QueuedMutation<P = unknown> {
  id: string;
  type: MutationType;
  payload: P;
  createdAt: string;
  attemptCount: number;
  lastError: string | null;
}

export interface QueueStore {
  read: () => Promise<QueuedMutation[]>;
  write: (next: QueuedMutation[]) => Promise<void>;
  // In-memory snapshot to avoid races between reads in tight loops.
  snapshot: () => QueuedMutation[];
}

export function createQueueStore(): QueueStore {
  let memo: QueuedMutation[] = [];
  let hydrated = false;
  const hydrate = (async () => {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    memo = raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
    hydrated = true;
  })();

  return {
    async read() {
      if (!hydrated) await hydrate;
      return memo;
    },
    async write(next) {
      memo = next;
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(next));
    },
    snapshot() {
      return memo;
    },
  };
}

export async function enqueue<P>(
  store: QueueStore,
  input: { type: MutationType; payload: P }
): Promise<QueuedMutation<P>> {
  const all = await store.read();
  const next: QueuedMutation<P> = {
    id: nanoid(),
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    attemptCount: 0,
    lastError: null,
  };
  await store.write([...all, next as QueuedMutation]);
  return next;
}

export async function dequeue(store: QueueStore, id: string): Promise<void> {
  const all = await store.read();
  await store.write(all.filter((m) => m.id !== id));
}

export async function markFailed(
  store: QueueStore,
  id: string,
  error: string
): Promise<void> {
  const all = await store.read();
  const next = all.map((m) =>
    m.id === id ? { ...m, attemptCount: m.attemptCount + 1, lastError: error } : m
  );
  await store.write(next);
}

export async function getAll(store: QueueStore): Promise<QueuedMutation[]> {
  return store.read();
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- queue.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/offline/queue.ts tests/offline/queue.test.ts
git commit -m "feat(offline): typed mutation queue with AsyncStorage persistence"
```

---

## Task 14: Offline queue — processor with retry/backoff

**Files:**
- Create: `src/offline/processor.ts`
- Create: `tests/offline/processor.test.ts`

The processor accepts a registry of handlers (one per mutation type). Plan B registers the actual handlers; here we build the generic drainer and test it with stubs.

- [ ] **Step 1: Write the failing test**

File: `tests/offline/processor.test.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueueStore,
  enqueue,
  getAll,
  type QueuedMutation,
} from '@/offline/queue';
import { drainQueue, type MutationHandler } from '@/offline/processor';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('drainQueue', () => {
  it('processes mutations FIFO and removes them on success', async () => {
    const store = createQueueStore();
    const order: string[] = [];
    const handler: MutationHandler = async (m: QueuedMutation) => {
      order.push(String((m.payload as any).tag));
    };

    await enqueue(store, { type: 'create_komanda', payload: { tag: 'a' } });
    await enqueue(store, { type: 'add_item', payload: { tag: 'b' } });

    await drainQueue(store, { create_komanda: handler, add_item: handler } as any);

    expect(order).toEqual(['a', 'b']);
    expect(await getAll(store)).toEqual([]);
  });

  it('increments attemptCount on transient failure and stops the drain', async () => {
    const store = createQueueStore();
    await enqueue(store, { type: 'create_komanda', payload: { tag: 'a' } });
    await enqueue(store, { type: 'create_komanda', payload: { tag: 'b' } });

    const failing: MutationHandler = async () => {
      throw new Error('network');
    };
    await drainQueue(store, { create_komanda: failing } as any);

    const remaining = await getAll(store);
    expect(remaining).toHaveLength(2);
    expect(remaining[0].attemptCount).toBe(1);
    expect(remaining[0].lastError).toBe('network');
    // Second mutation was never attempted (drain halts on first failure).
    expect(remaining[1].attemptCount).toBe(0);
  });

  it('skips mutations that exceed maxAttempts', async () => {
    const store = createQueueStore();
    await AsyncStorage.setItem(
      '@komanda/mutation-queue/v1',
      JSON.stringify([
        {
          id: 'stuck',
          type: 'create_komanda',
          payload: {},
          createdAt: '2026-04-20T00:00:00.000Z',
          attemptCount: 5,
          lastError: 'boom',
        },
      ])
    );
    const store2 = createQueueStore();
    await new Promise((r) => setTimeout(r, 0));

    const failing: MutationHandler = async () => {
      throw new Error('still broken');
    };
    await drainQueue(store2, { create_komanda: failing } as any, { maxAttempts: 5 });

    const remaining = await getAll(store2);
    expect(remaining).toHaveLength(1);
    // attemptCount not incremented — the mutation was skipped.
    expect(remaining[0].attemptCount).toBe(5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- processor.test`
Expected: FAIL — "Cannot find module '@/offline/processor'".

- [ ] **Step 3: Write the processor**

File: `src/offline/processor.ts`

```ts
import {
  dequeue,
  getAll,
  markFailed,
  type QueuedMutation,
  type QueueStore,
  type MutationType,
} from './queue';

export type MutationHandler = (m: QueuedMutation) => Promise<void>;
export type HandlerRegistry = Record<MutationType, MutationHandler>;

export interface DrainOptions {
  maxAttempts?: number;
}

/**
 * Drain the queue FIFO. Stops on the first failure so that writes for the same
 * komanda (e.g. create → add_item) stay in order. Mutations past maxAttempts
 * are skipped; the UI is responsible for surfacing them to the user.
 */
export async function drainQueue(
  store: QueueStore,
  handlers: HandlerRegistry,
  opts: DrainOptions = {}
): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const all = await getAll(store);

  for (const m of all) {
    if (m.attemptCount >= maxAttempts) continue;

    const handler = handlers[m.type];
    if (!handler) {
      await markFailed(store, m.id, `no_handler:${m.type}`);
      return; // Stop drain; do not reorder.
    }
    try {
      await handler(m);
      await dequeue(store, m.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markFailed(store, m.id, msg);
      return; // Stop drain on failure; exponential backoff handled by caller.
    }
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- processor.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/offline/processor.ts tests/offline/processor.test.ts
git commit -m "feat(offline): FIFO queue drainer with retry budget"
```

---

## Task 15: TanStack Query provider with AsyncStorage persistence

**Files:**
- Create: `src/offline/QueryProvider.tsx`

- [ ] **Step 1: Write the provider**

File: `src/offline/QueryProvider.tsx`

```tsx
import { ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Offline-tolerant defaults.
            staleTime: 1000 * 30,
            gcTime: TWENTY_FOUR_HOURS,
            retry: 2,
            refetchOnReconnect: 'always',
          },
        },
      }),
    []
  );

  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: AsyncStorage,
        key: '@komanda/react-query/v1',
        throttleTime: 1000,
      }),
    []
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: TWENTY_FOUR_HOURS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/offline/QueryProvider.tsx
git commit -m "feat(offline): TanStack Query provider with AsyncStorage persistence"
```

---

## Task 16: Offline banner component

**Files:**
- Create: `src/components/OfflineBanner.tsx`

- [ ] **Step 1: Write the component**

File: `src/components/OfflineBanner.tsx`

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useOnline } from '@/offline/network';

export function OfflineBanner() {
  const online = useOnline();
  if (online !== false) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline — changes will sync when reconnected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/OfflineBanner.tsx
git commit -m "feat(ui): offline banner"
```

---

## Task 17: Sign-in screen

**Files:**
- Modify: `app/(auth)/sign-in.tsx` (replace placeholder)

- [ ] **Step 1: Replace the placeholder sign-in screen**

File: `app/(auth)/sign-in.tsx`

```tsx
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { insforge } from '@/insforge/client';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await insforge.auth.signIn({ email, password });
      if (error) throw error;
      router.replace('/(app)/komandas');
    } catch (e: any) {
      setError(e?.message ?? 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Komanda</Text>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          disabled={submitting || !email || !password}
          onPress={onSubmit}
          style={[styles.button, (submitting || !email || !password) && styles.buttonDisabled]}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </TouchableOpacity>
        <Link href="/(auth)/sign-up" style={styles.link}>
          Have an invite? Tap here.
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', backgroundColor: '#f4f4f5' },
  card: { padding: 20, margin: 20, backgroundColor: 'white', borderRadius: 12, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', fontSize: 14 },
  link: { color: '#2563eb', fontSize: 14, textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/sign-in.tsx
git commit -m "feat(auth): email + password sign-in screen"
```

---

## Task 18: Sign-up via invitation screen

**Files:**
- Create: `app/(auth)/sign-up.tsx`

- [ ] **Step 1: Write the sign-up screen**

File: `app/(auth)/sign-up.tsx`

```tsx
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { insforge } from '@/insforge/client';
import { redeemInvitation } from '@/insforge/queries/invitations';

export default function SignUp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle links arriving while the app is open (komanda://invite?token=...).
  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      const parsed = Linking.parse(event.url);
      const t = (parsed.queryParams as any)?.token;
      if (typeof t === 'string') setToken(t);
      const e = (parsed.queryParams as any)?.email;
      if (typeof e === 'string') setEmail(e);
    });
    return () => sub.remove();
  }, []);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { error: signUpErr } = await insforge.auth.signUp({
        email,
        password,
        name: displayName,
      });
      if (signUpErr) throw signUpErr;
      await redeemInvitation(token);
      router.replace('/(app)/komandas');
    } catch (e: any) {
      setError(e?.message ?? 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Accept invite</Text>
        <TextInput
          placeholder="Invite token"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          disabled={submitting || !token || !email || !password || !displayName}
          onPress={onSubmit}
          style={[styles.button, (submitting || !token || !email || !password || !displayName) && styles.buttonDisabled]}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Create account</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', backgroundColor: '#f4f4f5' },
  card: { padding: 20, margin: 20, backgroundColor: 'white', borderRadius: 12, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/sign-up.tsx
git commit -m "feat(auth): invite-redemption sign-up screen with deep link support"
```

---

## Task 19: "No org" edge-case screen

**Files:**
- Create: `app/(auth)/no-org.tsx`

- [ ] **Step 1: Write the screen**

File: `app/(auth)/no-org.tsx`

```tsx
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { insforge } from '@/insforge/client';

export default function NoOrg() {
  const router = useRouter();

  async function signOut() {
    await insforge.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>No organization yet</Text>
      <Text style={styles.body}>
        Your account isn't linked to an organization. Ask your admin to send
        you an invite link, then tap it to join.
      </Text>
      <TouchableOpacity onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f4f4f5', gap: 16 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center', color: '#525252' },
  button: { backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/no-org.tsx
git commit -m "feat(auth): no-org edge-case screen"
```

---

## Task 20: Root layout wires providers + auth gate

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(app)/_layout.tsx`

- [ ] **Step 1: Rewrite `app/_layout.tsx` with providers**

File: `app/_layout.tsx`

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { QueryProvider } from '@/offline/QueryProvider';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function RootLayout() {
  return (
    <QueryProvider>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="auto" />
    </QueryProvider>
  );
}
```

- [ ] **Step 2: Rewrite `app/(app)/_layout.tsx` with the auth/membership gate**

File: `app/(app)/_layout.tsx`

```tsx
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/insforge/session';
import { fetchMyMembership } from '@/insforge/queries/membership';

export default function AppLayout() {
  const session = useSession();

  // Membership query runs only when signed in.
  const signedIn = session.status === 'signed-in';
  const membership = useQuery({
    queryKey: ['membership', signedIn ? session.session.userId : null],
    queryFn: fetchMyMembership,
    enabled: signedIn,
    staleTime: 1000 * 60 * 5,
  });

  if (session.status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (session.status === 'signed-out') {
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (membership.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!membership.data) {
    return <Redirect href="/(auth)/no-org" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Boot the app and verify the gate works**

Run: `npx expo start --ios`
Expected:
- Cold start with no session → sign-in screen.
- Sign in with a test user that has a membership → lands on `komandas` placeholder.
- Sign in with a test user without a membership → redirects to `no-org`.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/\(app\)/_layout.tsx
git commit -m "feat(auth): root providers + (app) auth and membership gate"
```

---

## Task 21: Settings screen (profile + sign out)

**Files:**
- Create: `app/(app)/settings.tsx`

- [ ] **Step 1: Write the screen**

File: `app/(app)/settings.tsx`

```tsx
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { insforge } from '@/insforge/client';
import { fetchMyMembership } from '@/insforge/queries/membership';

export default function Settings() {
  const router = useRouter();
  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });

  async function signOut() {
    await insforge.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Account</Text>
      <Text style={styles.label}>Display name</Text>
      <Text style={styles.value}>{membership?.display_name ?? '—'}</Text>
      <Text style={styles.label}>Role</Text>
      <Text style={styles.value}>{membership?.role ?? '—'}</Text>
      <TouchableOpacity onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, backgroundColor: 'white', gap: 8 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 12, color: '#737373', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16 },
  button: { backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 32 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings.tsx
git commit -m "feat(app): settings screen with profile and sign-out"
```

---

## Task 22: Menu query hooks + smoke-test rendering

**Files:**
- Modify: `app/(app)/komandas/index.tsx` (enrich the placeholder to prove menu fetch works)

- [ ] **Step 1: Update the placeholder komandas screen to fetch menu**

File: `app/(app)/komandas/index.tsx`

```tsx
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchProducts } from '@/insforge/queries/menu';

export default function Komandas() {
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.header}>Komandas (placeholder)</Text>
      <Text style={styles.sub}>Menu items loaded from Insforge:</Text>
      {products.isLoading ? (
        <ActivityIndicator />
      ) : products.error ? (
        <Text style={styles.error}>Error: {(products.error as Error).message}</Text>
      ) : (
        <View style={{ gap: 4, marginTop: 8 }}>
          {products.data?.map((p) => (
            <Text key={p.id}>
              {p.name} — ${(p.price_cents / 100).toFixed(2)}
            </Text>
          )) ?? null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 8 },
  header: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 14, color: '#525252' },
  error: { color: '#dc2626' },
});
```

- [ ] **Step 2: Manually seed a product via the Next.js dashboard or a one-off SQL insert**

For the purpose of this smoke test only, insert one product:

```sql
insert into public.products (org_id, name, category, price_cents)
values ((select id from public.organizations limit 1), 'Taco al pastor', 'Tacos', 2500);
```

Apply via `npx @insforge/cli db execute --sql "..."` or the dashboard SQL editor.

- [ ] **Step 3: Run the app end-to-end**

Run: `npx expo start --ios`
Expected:
- Sign in with a test account that has membership in the org containing the product.
- Lands on komandas screen.
- Product name + price displays.
- Toggle airplane mode; force-quit and relaunch; products still display from cache. Offline banner visible.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/komandas/index.tsx
git commit -m "feat(app): smoke-test fetch of products into placeholder komandas screen"
```

---

## Task 23: README + Plan B handoff notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with a runbook**

File: `README.md`

````markdown
# komanda-app

Native mobile app for taco-restaurant waiters to take and track orders. Expo (expo-router) + Insforge (Postgres + Auth) directly from the client.

See the design spec: [docs/superpowers/specs/2026-04-18-komanda-app-v1-design.md](docs/superpowers/specs/2026-04-18-komanda-app-v1-design.md).

## Prerequisites

- Node 20+
- iOS Simulator (macOS) or Android Emulator
- Access to the Komanda Insforge project (org id recorded in the sibling `komanda` repo at `.insforge/project.json`)

## Setup

```bash
npm install
cp .env.example .env
# get the anon key from the sibling komanda repo
npx @insforge/cli --project ../komanda secrets get ANON_KEY
# paste it into .env as EXPO_PUBLIC_INSFORGE_ANON_KEY
```

## Run

```bash
npx expo start --ios     # or --android
```

## Test

```bash
npm test                # unit + component tests via jest-expo
```

## Apply SQL migrations

Migrations live in `supabase-sql/` numbered in order. Apply in order on a fresh project:

```bash
npx @insforge/cli db execute --file supabase-sql/0001_schema.sql
npx @insforge/cli db execute --file supabase-sql/0002_rls.sql
npx @insforge/cli db execute --file supabase-sql/0003_rpc_redeem_invitation.sql
npx @insforge/cli db execute --file supabase-sql/0004_rpc_next_komanda_number.sql
```

## Structure

- `app/` — expo-router routes (`(auth)` + `(app)` groups)
- `src/insforge/` — Insforge client, session hook, row schemas, query helpers
- `src/offline/` — TanStack Query provider + mutation queue + NetInfo hook
- `src/components/` — shared UI
- `supabase-sql/` — SQL migrations for Insforge
- `tests/` — Jest tests
- `docs/superpowers/` — specs + plans

## Current status (Plan A — Foundation)

Shipped: Insforge schema + RLS, email/password sign-in, invite-redemption sign-up, auth-and-membership gate, offline banner, queued-mutation primitives, menu read hooks.

Pending: Plan B (waiter flow — komanda CRUD, add-item, close + PDF receipt, Maestro E2E).
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: runbook and current-status notes after foundation plan"
```

---

## Verification at end of Plan A

Before declaring Plan A complete, manually confirm:

- [ ] `npm test` — all tests green.
- [ ] `npx tsc --noEmit` — no type errors.
- [ ] `npx expo start --ios` — app boots, sign-in screen renders, offline banner appears with airplane mode on.
- [ ] Creating an invite via SQL + accepting it via the sign-up screen results in the user landing on the komandas placeholder.
- [ ] Killing the app and relaunching reuses the persisted session (no re-login prompt).
- [ ] With airplane mode on, cached menu still renders on the komandas placeholder screen.
- [ ] SQL migrations applied on the Insforge project; RLS policies pass the two-user isolation check from Task 5 Step 3.
