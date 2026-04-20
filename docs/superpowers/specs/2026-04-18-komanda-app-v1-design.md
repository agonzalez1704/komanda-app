# Komanda App — v1 Design

**Date:** 2026-04-18
**Scope:** Native mobile app (Expo / React Native) that waiters use to take and track orders ("komandas") at a taco restaurant. This spec covers **only the mobile app**. The Next.js admin dashboard in the sibling `komanda` project is out of scope here and gets its own spec.

---

## 1. Goals & Non-Goals

### Goals
- Replace paper tickets with a native app waiters can use on their phones.
- Let any signed-in org member open a komanda, add items (product + variant + quantity + modifiers), track its status, and close it with a PDF receipt.
- Support multi-tenant orgs via a home-grown `organizations` + `organization_members` model on top of Insforge auth.
- Work when wifi drops mid-shift.

### Non-goals (v1)
- Menu CRUD on mobile (lives in the Next.js dashboard).
- Apple Tap to Pay / Stripe Terminal integration.
- Thermal printer support.
- Tips, split payment, table-map UI.
- Kitchen display screen.
- Tax reporting / analytics dashboards.
- Multi-language (English-only for v1).

---

## 2. Architecture

### Stack
- **Expo 54** + **expo-router 6** (already scaffolded).
- **`@insforge/sdk`** for both **auth** and **Postgres data** (single SDK; Insforge handles session + `auth.uid()` in RLS policies).
- **TanStack Query** for server-state fetching + caching, persisted to AsyncStorage.
- **Zustand** for transient UI state (current cart being edited).
- **AsyncStorage** for persisted query cache and the offline mutation queue.
- **@react-native-community/netinfo** for connectivity detection.
- **expo-print** + **expo-sharing** for PDF receipts.

### Client-server boundary
Mobile app talks **directly to Insforge**. No Next.js API in between for v1. If shared business logic between mobile and dashboard becomes painful later, we'll promote to a Next.js API gateway; migration is mostly mechanical and does not require rewriting the mobile app.

### Tenancy
- We own the multi-tenant model in our schema (Insforge does not provide org primitives). Tables involved:
  - `organizations` — one row per restaurant.
  - `organization_members` — links `auth.users.id` to an organization with a role and display name. Also acts as the app-side profile table.
  - `invitations` — pending invites issued by admins, redeemed on sign-up.
- Every business table has `org_id uuid not null`.
- Backend **RLS policies** enforce `org_id = (SELECT org_id FROM organization_members WHERE auth_user_id = auth.uid())` on every read and write. Helper function is marked `SECURITY DEFINER` to avoid recursive RLS on `organization_members` itself.
- **v1 constraint: one organization per user.** This keeps the client trivial (no org picker). Multi-org per user is an explicit v1.x follow-up.

### Auth flow
- All users — admin or member — sign in with **Insforge email + password** via `insforge.auth.signIn({ email, password })`.
- **Admin bootstrapping**: the very first admin for an organization is created via the Next.js dashboard (out of scope for this spec). Admins can also be created by inviting with `role='admin'`.
- **Waiter onboarding via invitation**:
  1. Admin enters email + role in the Next.js dashboard (or — v1.x — in a future mobile admin screen). Server inserts an `invitations` row with a random `token`, `expires_at` (7 days), and `role`.
  2. Admin sends the link to the waiter out-of-band (WhatsApp, text, shout across the counter). Link format: `komanda://invite?token=<token>` (deep link handled by expo-router) + a web fallback.
  3. Waiter opens the link on the mobile app → `sign-up` screen prefilled with the invited email and the token in a hidden field.
  4. Waiter enters a password + display name. App calls `insforge.auth.signUp({ email, password, name })`. On success, app calls an RPC `redeem_invitation(token)` which:
     - Verifies token + email match, not expired, not already accepted.
     - Inserts `organization_members` row linking `auth.uid()` to the org with the invited role + display name.
     - Marks the invitation `accepted_at = now()`.
- On sign-in, the app calls `GET organization_members WHERE auth_user_id = auth.uid()` to resolve the user's org and role.
- If the user has no membership row (edge case: their invite was revoked or they signed up without an invite), show a "Ask your admin to invite you" screen with sign-out.
- Session is persisted by `@insforge/sdk` to AsyncStorage automatically; re-opening the app resumes the session.

---

## 3. Data Model

All IDs are UUIDs. Auth identity is owned by Insforge in `auth.users(id)`; we reference it with `auth_user_id`. Prices are stored as integer cents.

```
organizations
  id            pk uuid default gen_random_uuid()
  name          text
  created_at    timestamptz default now()

organization_members
  id               pk uuid default gen_random_uuid()
  auth_user_id     uuid not null references auth.users(id) on delete cascade
  org_id           uuid not null references organizations(id) on delete cascade
  role             text not null check (role in ('admin', 'member'))
  display_name     text not null
  created_at       timestamptz default now()
  unique(auth_user_id)        -- v1 constraint: one org per user
  unique(auth_user_id, org_id)

invitations
  id                       pk uuid default gen_random_uuid()
  org_id                   uuid not null references organizations(id) on delete cascade
  email                    citext not null
  role                     text not null check (role in ('admin', 'member'))
  token                    text not null unique      -- random 32+ char
  expires_at               timestamptz not null
  accepted_at              timestamptz null
  created_by_auth_user_id  uuid not null references auth.users(id)
  created_at               timestamptz default now()

products
  id            pk uuid
  org_id        fk -> organizations.id
  name          text
  category      text                       -- freeform grouping, e.g. "Tacos", "Bebidas"
  price_cents   integer                    -- IVA included
  active        boolean default true       -- soft delete
  sort_order    integer default 0
  created_at    timestamptz

variants
  id            pk uuid
  product_id    fk -> products.id
  org_id        fk -> organizations.id
  name          text                       -- label only; no price
  active        boolean default true
  sort_order    integer default 0

modifiers
  id            pk uuid
  org_id        fk -> organizations.id
  name          text                       -- e.g., "sin cilantro", "extra salsa"
  active        boolean default true

komandas
  id                        pk uuid
  org_id                    fk -> organizations.id
  number                    text null            -- e.g., "komanda-20260418-007"; null until synced
  display_name              text null            -- optional waiter rename, e.g., "Table 5"
  status                    text not null default 'open' check (status in ('open','pending','served','closed'))
  opened_by_auth_user_id    uuid not null references auth.users(id)
  opened_at                 timestamptz
  closed_at                 timestamptz null
  closed_by_auth_user_id    uuid null references auth.users(id)
  payment_method            text null check (payment_method in ('cash','card','transfer'))
  total_cents               integer null         -- snapshot at close
  local_uuid                uuid                 -- stable client-generated id for offline-first creates

komanda_items
  id                        pk uuid
  komanda_id                fk -> komandas.id
  org_id                    fk -> organizations.id
  product_id                fk -> products.id
  variant_id                fk -> variants.id null
  quantity                  integer check (quantity > 0)
  unit_price_cents          integer                -- snapshot at add-time
  product_name_snapshot     text                   -- snapshot at add-time
  variant_name_snapshot     text null              -- snapshot at add-time
  note_text                 text null              -- free-text per-line note
  created_at                timestamptz

komanda_item_modifiers
  id                pk uuid
  komanda_item_id   fk -> komanda_items.id
  modifier_id       fk -> modifiers.id
  name_snapshot     text                            -- snapshot at add-time

counters
  org_id        fk -> organizations.id
  date          date                                -- e.g., 2026-04-18
  last_number   integer default 0
  primary key (org_id, date)
```

### Design notes
- `local_uuid` on `komandas` exists so that offline-created komandas have a stable identity before the server assigns `number`.
- `number` is the formatted `komanda-YYYYMMDD-NNN`; `display_name` is the optional rename. Both displayed on the list card.
- Status transitions are free-form and waiter-driven; no state machine enforcement for v1.
- `komanda_items` snapshot `product_name_snapshot`, `variant_name_snapshot`, and `unit_price_cents` at add-time. Historical receipts do not change when admins edit the menu.
- `komanda_item_modifiers.name_snapshot` exists for the same reason.
- Soft-delete (`active=false`) on products, variants, modifiers preserves referential integrity for historical komandas.

---

## 4. Komanda Numbering

Format: `komanda-YYYYMMDD-NNN` (e.g., `komanda-20260418-007`).

- Counter is **per org, per day**, shared across all waiters.
- Resets implicitly each day because the date is part of the name.
- Server assigns the number atomically when processing the `create_komanda` mutation:
  ```sql
  INSERT INTO counters (org_id, date, last_number)
  VALUES ($1, $2, 1)
  ON CONFLICT (org_id, date)
  DO UPDATE SET last_number = counters.last_number + 1
  RETURNING last_number;
  ```
- Waiter may rename via `display_name`. The internal `number` is never user-editable.

---

## 5. Screens & Routes

`expo-router` file-based routing:

```
app/
  (auth)/
    sign-in.tsx              -- email + password
    sign-up.tsx              -- invite-redemption: prefilled email, token from deep link
    no-org.tsx               -- "Ask your admin to invite you" edge case
  (app)/
    _layout.tsx              -- requires signed-in + membership; bottom tab bar
    komandas/
      index.tsx              -- LIST
      new.tsx                -- creates komanda, redirects to [id]
      [id]/
        index.tsx            -- DETAIL
        add-item.tsx         -- product picker → variant → qty → modifiers/note
        close.tsx            -- payment method + confirm + share receipt
    settings.tsx             -- profile, sign out
  _layout.tsx                -- InsforgeProvider + QueryClientProvider + offline boot
```

**Deep link for invites:** scheme registered in `app.json` so links like `komanda://invite?token=<token>` (and an https universal link fallback) land on `sign-up.tsx` with the token prefilled.

### Komandas list (`komandas/index.tsx`)
- Shows **today's komandas** by default, sorted newest first.
- Card: number (or "offline pending"), display_name, item count, running total, status pill, time since opened, small cloud-off icon if not yet synced.
- Floating **+ New komanda** button.
- Date filter in the header for browsing past days.
- Pull-to-refresh refetches komandas + menu.

### New komanda (`komandas/new.tsx`)
- Single action: creates a komanda row with:
  - `local_uuid` generated client-side
  - `opened_by_auth_user_id` = `auth.uid()` of the current user
  - `opened_at` = local time (reconciled on sync)
  - `status = 'open'`
  - `number` = null (server assigns)
- Optional rename field visible before tap; default empty.
- Redirects to `komandas/[id]` immediately, working against the local record.

### Komanda detail (`komandas/[id]/index.tsx`)
- Header: number/offline-badge, display_name, status dropdown.
- Items list with qty × name (variant), modifiers as chips below, per-line note in small italics, line total on the right.
- Tap an item: edit quantity, edit note, remove.
- Running total pinned at the bottom.
- Primary button: **Add item**.
- Secondary button: **Close & charge** (disabled while 0 items).
- For `closed` komandas: items become read-only, "Close & charge" replaced with **Share receipt again**.

### Add item (`komandas/[id]/add-item.tsx`)
- Separate route (not modal) so the waiter keeps flow when adding several items.
- Top: category chips, searchable.
- Grid of product cards (active products only).
- Tap product:
  - If product has variants → variant picker (single-select).
  - Quantity stepper (default 1).
  - Modifier toggles (multi-select, from org-wide modifiers).
  - Free-text note field.
  - **Add to komanda** button.
- On confirm: snapshot `product_name`, `variant_name`, `unit_price_cents`, modifier `name`s; enqueue `add_item`; navigate back to detail.

### Close & charge (`komandas/[id]/close.tsx`)
- Read-only summary of items with line totals.
- Totals block: `Total · $XXX.XX` with caption "IVA incluido".
- Payment method chips: **Cash / Card / Transfer**. Single-select, required.
- Primary button: **Confirm & share receipt**.
- On tap:
  1. Locally marks komanda `closed`, sets `closed_at`, `closed_by_auth_user_id`, `payment_method`, snapshots `total_cents`.
  2. Enqueues `close_komanda` mutation.
  3. Renders PDF from local data.
  4. Opens native share sheet (expo-sharing).
  5. Navigates back to list.

### Settings
- User profile name, email.
- Switch org (if multi-org).
- Sign out.

### Role gating
- `organization_members.role` of `admin` vs `member` grants no extra mobile UI in v1. Every signed-in org member uses the app as a waiter; admin-only actions (menu CRUD, issuing invites) happen on the Next.js dashboard.

---

## 6. Menu Data on Mobile (Read-Only)

- Mobile app **reads** `products`, `variants`, `modifiers` from Insforge, scoped to `org_id`.
- Cached in TanStack Query with AsyncStorage persistence.
- Refreshed: on cold start, on pull-to-refresh, and when the add-item screen opens (stale-while-revalidate).
- **No CRUD UI on mobile.** Admins manage the menu on the Next.js dashboard (separate spec).

---

## 7. Offline Strategy

### Reads
- TanStack Query with `persistQueryClient` + AsyncStorage.
- Last-known komandas list, komanda detail, and menu data stay available offline.
- UI shows a subtle "Offline" banner when `NetInfo` reports no connection.

### Writes — mutation queue
- Every write goes through `enqueue(mutation)` backed by AsyncStorage.
- Each queued mutation:
  ```
  {
    id: uuid,
    type: 'create_komanda' | 'rename_komanda' | 'update_status'
        | 'add_item' | 'update_item' | 'remove_item'
        | 'close_komanda',
    payload: { ... },       // references local_uuid or server ids
    createdAt: iso8601,
    attemptCount: number,
    lastError: string | null,
  }
  ```
- On `NetInfo` "online" transition, a background processor drains the queue FIFO with exponential backoff on failure.

### Komanda numbering offline
1. When offline, the app creates the komanda locally with `local_uuid`, `number = null`, and optional `display_name`.
2. All subsequent writes reference `local_uuid` until the create syncs.
3. On sync, server assigns `number` via the counter transaction, returns server id. Client maps `local_uuid → server_id` and rewrites any queued mutations that still reference `local_uuid`.
4. List screen shows un-synced komandas with a cloud-off icon.

### Close and charge **works fully offline**
- `close_komanda` is just another queued mutation.
- PDF receipt is generated from local data with no network call.
- Identifier on the receipt:
  - If synced → real `komanda-YYYYMMDD-NNN`.
  - If not yet synced → human identifier like `Ticket — 2026-04-18 14:32 — Table 5` plus a small "Ref: pending" note.
- Customer receives their bill immediately; internal numbering reconciles on next sync.

### Re-sharing a receipt
- Closed-komanda detail shows **Share receipt again**. Re-runs HTML → PDF → share from stored data. Idempotent.

### Conflicts (explicitly ignored for v1)
- Two waiters editing the same komanda simultaneously → last write wins per field. Low real-world risk.
- Closing an already-closed komanda → backend rejects; client toasts and refetches.

### What is NOT offline
- Menu data changes (happen on Next.js dashboard; mobile is read-only).
- Insforge sign-in / sign-up / invite redemption (all require network).

---

## 8. PDF Receipt

Rendered via `expo-print` from an HTML template at ~302pt width (thermal-printer-friendly for future).

```
<org name>
<address / phone — from org settings, if provided>
---------------------------------------
<identifier>                     <date time>
Atendió: <waiter display_name>
---------------------------------------
2  Taco pastor                    $50.00
1  Quesadilla queso               $60.00
      · sin cebolla
1  Coca-Cola 600ml                $30.00
---------------------------------------
TOTAL                            $140.00
IVA incluido
Pago: Efectivo
---------------------------------------
¡Gracias por su visita!
```

- UI labels elsewhere in the app are English; the receipt is Spanish-default because it's customer-facing in a Mexican context. Text strings localised later if needed.
- Currency formatted with `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`.

---

## 9. Error Handling & Edge Cases

### Auth / org
- Signed-in user without an `organization_members` row → `no-org` screen with sign-out.
- Multi-org user → out of scope for v1 (schema unique constraint prevents it).
- Invite token invalid / expired / already redeemed → sign-up screen shows an inline error + a "Contact your admin" link.
- Insforge session expires → SDK refreshes silently; on refresh failure, sticky banner "Please sign in again" but cached komandas remain visible.

### Network / sync
- Mutation permanently fails after N retries (configurable, default 5) → komanda or item gets a red error badge. Tapping shows error + **Retry** / **Discard**. Writes are never silently dropped.
- Server rejects a transition (e.g., editing a closed komanda) → toast + refetch; local state reconciles to server truth.
- Timestamps: offline uses device clock; server overrides on successful sync.

### Data integrity
- `product_name_snapshot`, `variant_name_snapshot`, `unit_price_cents`, and modifier `name_snapshot` on line items/modifiers ensure historical receipts don't change when admins edit the menu.
- Products/variants/modifiers soft-deleted (`active=false`) so references survive.

### UX
- Empty komanda close attempt → button disabled, tooltip "Add at least one item."
- Double-tap on **Confirm & share** → button disables while mutation is queued.
- Receipt share sheet dismissed without sharing → komanda is still closed; reshare available from detail.

---

## 10. Testing Strategy

### Unit (Jest + @testing-library/react-native)
- Komanda number formatting.
- Total calculator.
- Mutation queue reducer.
- Offline ↔ online reconciliation (local_uuid → server id mapping; queued mutation rewrite).
- Line-item snapshot logic.

### Component
- Komandas list rendering with various status + offline badge combos.
- Add-item screen: with and without variants; modifier toggling.
- Close screen gating (items present, payment method selected).

### Integration
- TanStack Query + AsyncStorage persistence (queries rehydrate while offline).
- Mutation queue: enqueue offline, drain in order online, handle server rejections.
- Insforge SDK: mock `insforge.auth` + `insforge.database` at a single boundary module to simulate signed-in/out + membership lookups.

### End-to-end (Maestro)
- Sign in → create komanda → add 2 items → close with cash → receipt shared.
- Go offline → create komanda → add items → come back online → verify real number assigned.

### Manual QA (v1 sign-off)
- Real device iOS + Android, real Insforge project, real org + invite flow.
- Wifi toggling to simulate shop conditions.
- Two devices concurrently creating komandas → distinct numbers assigned.
- Menu change on Next.js dashboard propagates to mobile after refresh; historical komandas unchanged.

### Out of scope
- Load testing (single-shop scale).
- Visual regression.

---

## 11. Deliberate Deferrals

- Apple Tap to Pay / Stripe Terminal.
- Thermal (ESC/POS) printer support.
- Tips, split payments, table-map UI.
- Kitchen display / routing.
- Per-product modifier scoping (modifiers are org-wide in v1).
- Product photos.
- Inventory / stock.
- Happy-hour / time-based menus.
- Tax reporting and end-of-day Z reports.
- Multi-language UI toggle (English-only in v1; receipt is Spanish).
- Per-device "daily shift PIN" fast re-auth.
- Multi-org per user (unique constraint on `organization_members.auth_user_id` prevents it in v1).
- OAuth sign-in (Insforge supports Google/GitHub; not in v1).
- In-app admin-side invite creation (v1 admins issue invites from the Next.js dashboard).

---

## 12. Open Questions

None blocking v1 as of 2026-04-18. Items in §11 will each be re-evaluated for v1.1+.
