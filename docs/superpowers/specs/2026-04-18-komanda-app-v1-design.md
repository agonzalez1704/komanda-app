# Komanda App — v1 Design

**Date:** 2026-04-18
**Scope:** Native mobile app (Expo / React Native) that waiters use to take and track orders ("komandas") at a taco restaurant. This spec covers **only the mobile app**. The Next.js admin dashboard in the sibling `komanda` project is out of scope here and gets its own spec.

---

## 1. Goals & Non-Goals

### Goals
- Replace paper tickets with a native app waiters can use on their phones.
- Let any signed-in org member open a komanda, add items (product + variant + quantity + modifiers), track its status, and close it with a PDF receipt.
- Support multi-tenant orgs via Clerk Organizations.
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
- **Clerk Expo SDK** for auth + Organizations.
- **Insforge JS client** for Postgres data, authenticated with the Clerk JWT via an Insforge JWT template.
- **TanStack Query** for server-state fetching + caching, persisted to AsyncStorage.
- **Zustand** for transient UI state (current cart being edited).
- **AsyncStorage** for persisted query cache and the offline mutation queue.
- **@react-native-community/netinfo** for connectivity detection.
- **expo-print** + **expo-sharing** for PDF receipts.

### Client-server boundary
Mobile app talks **directly to Insforge**. No Next.js API in between for v1. If shared business logic between mobile and dashboard becomes painful later, we'll promote to a Next.js API gateway; migration is mostly mechanical and does not require rewriting the mobile app.

### Tenancy
- Clerk Organizations map 1:1 to tenants.
- Every Insforge table has `org_id uuid not null` = Clerk organization id.
- Backend row-level policies enforce `org_id = current_user_org` on every read and write.
- On the client, the active Clerk org is the implicit scope of all queries.

### Auth flow
- **Admins**: sign up / sign in with email + password via Clerk. Create the org and invite members via the Clerk-hosted flow.
- **Waiters** (Clerk role `member`): invited by email. Sign in with **email + 6-digit OTP** (passwordless). Rationale: no password to remember during shift changes.
- On successful sign-in, if the user belongs to multiple orgs, show an org picker before landing on `komandas`.
- If the user is not yet in any org, show a "Ask your admin to invite you" screen with sign-out.

---

## 3. Data Model

All IDs are UUIDs except Clerk-owned IDs (`users.id`, `organizations.id`, which are Clerk-provided strings). Prices are stored as integer cents.

```
organizations
  id            pk          (= Clerk org id, text)
  name          text
  created_at    timestamptz

users
  id            pk          (= Clerk user id, text)
  org_id        fk -> organizations.id
  role          enum('admin', 'member')    -- mirrored from Clerk org roles
  display_name  text
  created_at    timestamptz

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
  id                   pk uuid
  org_id               fk -> organizations.id
  number               text null            -- e.g., "komanda-20260418-007"; null until synced
  display_name         text null            -- optional waiter rename, e.g., "Table 5"
  status               enum('open', 'pending', 'served', 'closed') default 'open'
  opened_by_user_id    fk -> users.id
  opened_at            timestamptz
  closed_at            timestamptz null
  closed_by_user_id    fk -> users.id null
  payment_method       enum('cash', 'card', 'transfer') null
  total_cents          integer null         -- snapshot at close
  local_uuid           uuid                 -- stable client-generated id for offline-first creates

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
    sign-in.tsx              -- email + password (admin) or email + OTP (waiter)
    select-org.tsx           -- when user belongs to multiple orgs
  (app)/
    _layout.tsx              -- requires signed-in + active org; bottom tab bar
    komandas/
      index.tsx              -- LIST
      new.tsx                -- creates komanda, redirects to [id]
      [id]/
        index.tsx            -- DETAIL
        add-item.tsx         -- product picker → variant → qty → modifiers/note
        close.tsx            -- payment method + confirm + share receipt
    settings.tsx             -- profile, switch org, sign out
  _layout.tsx                -- ClerkProvider + QueryClientProvider + offline boot
```

### Komandas list (`komandas/index.tsx`)
- Shows **today's komandas** by default, sorted newest first.
- Card: number (or "offline pending"), display_name, item count, running total, status pill, time since opened, small cloud-off icon if not yet synced.
- Floating **+ New komanda** button.
- Date filter in the header for browsing past days.
- Pull-to-refresh refetches komandas + menu.

### New komanda (`komandas/new.tsx`)
- Single action: creates a komanda row with:
  - `local_uuid` generated client-side
  - `opened_by_user_id` = current user
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
  1. Locally marks komanda `closed`, sets `closed_at`, `closed_by_user_id`, `payment_method`, snapshots `total_cents`.
  2. Enqueues `close_komanda` mutation.
  3. Renders PDF from local data.
  4. Opens native share sheet (expo-sharing).
  5. Navigates back to list.

### Settings
- User profile name, email.
- Switch org (if multi-org).
- Sign out.

### Role gating
- Clerk `admin` role exists but grants no extra mobile UI in v1. Every signed-in org member uses the app as a waiter.

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
- Clerk sign-in (requires network).

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
- User not in any org → "Ask your admin to invite you" screen with sign-out.
- Multi-org user → `select-org` before `komandas`.
- Clerk session expires → silent refresh; on failure, sticky banner "Please sign in again" but cached komandas remain visible.

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
- Clerk: mock `useAuth` / `useOrganization` at a boundary to simulate signed-in/out + role.

### End-to-end (Maestro)
- Sign in → create komanda → add 2 items → close with cash → receipt shared.
- Go offline → create komanda → add items → come back online → verify real number assigned.

### Manual QA (v1 sign-off)
- Real device iOS + Android, real Insforge, real Clerk org.
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

---

## 12. Open Questions

None blocking v1 as of 2026-04-18. Items in §11 will each be re-evaluated for v1.1+.
