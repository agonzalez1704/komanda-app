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

## Current status (Plan A — Foundation)

Shipped: Insforge schema + RLS, email/password sign-in, invite-redemption sign-up, auth-and-membership gate, offline banner, queued-mutation primitives, menu read hooks.

Pending: Plan B (waiter flow — komanda CRUD, add-item, close + PDF receipt, Maestro E2E).
