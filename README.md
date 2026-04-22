# komanda-app

Native mobile app for taco-restaurant waiters to take and track orders. Expo (expo-router) + Insforge (Postgres + Auth) directly from the client.

See the design spec: [docs/superpowers/specs/2026-04-18-komanda-app-v1-design.md](docs/superpowers/specs/2026-04-18-komanda-app-v1-design.md).

## Prerequisites

- Node 20+
- iOS Simulator (macOS) or Android Emulator
- Access to the Komanda Insforge project (org id recorded in the sibling `komanda` repo at `.insforge/project.json`)

## Setup

```bash
pnpm install
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
pnpm test                # unit + component tests via jest-expo
```

End-to-end tests run through [Maestro](https://maestro.mobile.dev):

```bash
maestro test .maestro/sign-in-create-close.yaml
maestro test .maestro/offline-create-sync.yaml
```

Requires a seeded user `waiter@example.com` / `correcthorsebatterystaple` with membership in a test org that contains a product named `Taco al pastor`.

## Apply SQL migrations

Migrations live in `supabase-sql/` numbered in order. Apply in order on a fresh project:

```bash
cd ../komanda
npx @insforge/cli db import ../komanda-app/supabase-sql/0001_schema.sql
npx @insforge/cli db import ../komanda-app/supabase-sql/0002_rls.sql
npx @insforge/cli db import ../komanda-app/supabase-sql/0003_rpc_redeem_invitation.sql
npx @insforge/cli db import ../komanda-app/supabase-sql/0004_rpc_next_komanda_number.sql
```

## Structure

- `app/` — expo-router routes (`(auth)` + `(app)` groups)
- `src/insforge/` — Insforge client, session hook, row schemas, query helpers
- `src/offline/` — TanStack Query provider + mutation queue + NetInfo hook
- `src/components/` — shared UI
- `supabase-sql/` — SQL migrations for Insforge
- `tests/` — Jest tests
- `docs/superpowers/` — specs + plans

## Current status (v1)

Shipped:
- Sign in / invite-redeem / sign out.
- Komandas list (today, pull-to-refresh), new, detail, add item, close & charge, share PDF receipt.
- Offline: queued writes, local→server id mapping, queue drain on reconnect.
- Multi-tenant isolation via Insforge RLS.
- Jest + Maestro test suites.

Deliberately deferred (see spec §11):
- Menu CRUD on mobile (lives on Next.js dashboard).
- Tap-to-pay, thermal printers, tips, split payment, table map.
- Kitchen display.
- Multi-org per user, OAuth sign-in.

## Final manual QA checklist

Before calling v1 done, confirm on a real device + real Insforge project:

- [ ] Fresh sign-up via invite works end to end.
- [ ] Two concurrently-creating waiters get distinct komanda numbers.
- [ ] Airplane-mode create → items → close → receipt share all work; after reconnect, the komanda shows a real `komanda-YYYYMMDD-NNN` number.
- [ ] Deactivating a product on the dashboard does not alter historical komandas (snapshots preserved).
- [ ] Force-quit + relaunch restores session, last list, cached menu.
- [ ] `pnpm test` — all green.
- [ ] `pnpm exec tsc --noEmit` — no type errors.
- [ ] Maestro — both flows pass.
