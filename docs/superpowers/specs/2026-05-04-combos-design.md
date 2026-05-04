# Combos — Design

**Date:** 2026-05-04
**Status:** Approved

## Goal

Allow admins to define product bundles ("combos") sold at a fixed price. A combo is a fixed list of products + quantities; ordering a combo on a komanda adds the bundle as a single priced unit while still letting waiters apply per-item modifiers (e.g., "extra cheese" on one of the tacos).

Example: "Combo 1" = 3× Taco al Pastor + 1× Coca-Cola @ $69.00 (vs. à la carte total of $85.00).

## Non-goals

- Slot-based combos ("3× any taco"); v1 is fixed product list per combo.
- Multi-tier combos / combo-of-combos.
- Discount math beyond a flat per-combo price (no percentage discounts).
- Inventory effects beyond the existing per-product flow (combos don't ship a separate sales-by-product report yet).

## Concepts

### Combo definition (admin-side)
A combo bundles N products at fixed quantities, sold at a fixed price. Lives in the menu alongside products and modifiers.

### Combo placement (waiter/cashier-side)
Adding a combo to a komanda creates one `komanda_combos` row plus N `komanda_items` rows referencing it. The combo carries the price; child items carry product/modifier metadata at `unit_price_cents = 0`.

### Editability
Atomic. Removing a combo header cascades to its child items + modifiers. To change a combo, remove and re-add. Within the configurator sheet, the user can apply modifiers to each child item before committing.

## Permissions

| Action | admin | cashier | waiter | cook |
|---|---|---|---|---|
| Manage combo definitions (create / edit / deactivate) | ✓ | ✓ | ✗ | ✗ |
| Add combo to a komanda | ✓ | ✓ | ✓ | ✗ |
| Remove combo from a komanda | ✓ | ✓ | ✓ | ✗ |

Admin + cashier already share `can.manageMenu`; waiter shares `can.workKomanda`. Reuse those gates.

## Data model

### `combos` (new, per-org)

```sql
create table public.combos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  category    text not null default 'Combos',
  price_cents integer not null check (price_cents >= 0),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index combos_org_idx on public.combos(org_id);
```

### `combo_items` (new — combo composition)

```sql
create table public.combo_items (
  id          uuid primary key default gen_random_uuid(),
  combo_id    uuid not null references public.combos(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  variant_id  uuid references public.variants(id),
  quantity    integer not null check (quantity > 0),
  sort_order  integer not null default 0
);
create index combo_items_combo_idx on public.combo_items(combo_id);
```

### `komanda_combos` (new — instance of a combo on a komanda)

```sql
create table public.komanda_combos (
  id                       uuid primary key default gen_random_uuid(),
  komanda_id               uuid not null references public.komandas(id) on delete cascade,
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  combo_id                 uuid references public.combos(id),  -- nullable: combo definition may have been deleted later
  name_snapshot            text not null,
  category_snapshot        text not null,
  price_cents_snapshot     integer not null check (price_cents_snapshot >= 0),
  created_at               timestamptz not null default now(),
  local_uuid               uuid not null,
  unique (komanda_id, local_uuid)
);
create index komanda_combos_komanda_idx on public.komanda_combos(komanda_id);
```

### `komanda_items` (modify)

```sql
alter table public.komanda_items
  add column combo_id uuid references public.komanda_combos(id) on delete cascade;
create index komanda_items_combo_idx on public.komanda_items(combo_id);
```

When a child item belongs to a combo:
- `combo_id` is set
- `unit_price_cents = 0`
- `product_name_snapshot`, `variant_name_snapshot`, `quantity` carry as today
- modifiers attach normally via `komanda_item_modifiers`

### Pricing rule

- Komanda total = `Σ komanda_combos.price_cents_snapshot` + `Σ komanda_items.subtotal where combo_id is null`
- Free-floating item subtotal computed as today: `quantity * unit_price_cents`

### `aggregateAudit` impact

- Earnings include both free-floating item subtotals and combo snapshot prices.
- `byCategory` lookup falls back to `category_snapshot` on `komanda_combos` for combo lines.

## Screens

### S1. Admin combo list `/menu/combos` (admin + cashier)
- Header: "Combos" + back
- List of cards: name + `{N} items · ${price}` + active toggle (eye icon)
- FAB "+" → `/menu/combos/new`

### S2. Combo edit `/menu/combos/[id]` (admin + cashier)
- Form: name, category, price (numeric), active toggle
- Items section: list of `{qty}× {product_name}` rows + "+ Add product" → product picker (reuses existing menu lookup) → qty stepper
- Reorder via drag (deferred, optional v2)
- Save / Delete buttons

### S3. Settings → Menu navigation
- Add a "Combos" row in the existing Menu screen (Settings → Menu currently shows Products + Modifiers; add Combos beside them).

### S4. Order flow — combo configurator sheet
Triggered from the existing `add-item` screen. Combos render in a top section "Combos" before product categories.

- Tap combo card → opens bottom sheet
- Header: combo name + price
- Body: rows for each `combo_item`:
  - `{qty}× {product_name}{ · variant}`
  - "Add modifiers" button → opens existing modifier picker; selected modifiers shown as chips beneath
  - Note input (optional, per child item)
- Footer: "Add combo" primary button (locked while net required modifiers missing — same rule as today's add-item flow)

### S5. Komanda detail / close screen — grouped rendering
- Existing items list groups child rows under their combo header.
- Combo header row: bold name on left, snapshot price right-aligned.
- Child rows: indented (16px), smaller text, qty + name + mods underneath; no per-row price.
- Swipe-to-remove on the combo header cascades-deletes its children locally + on server.
- Free-floating items render unchanged.

### S6. Receipt (HTML for share/PDF)
Same grouping rule as in-app: combo header + indented children. Mirrors the in-app `KomandaTicket` layout.

## Data flow

### Define combo (admin)
- `INSERT combos` then `INSERT combo_items[]`. Done as a single transaction via RPC `upsert_combo(p_combo jsonb, p_items jsonb)` that takes the full payload and replaces composition atomically.

### Add combo to komanda
**Online path** — single RPC for atomicity:

```sql
add_komanda_combo(
  p_komanda_id          uuid,
  p_combo_id            uuid,
  p_local_uuid          uuid,
  p_name_snapshot       text,
  p_category_snapshot   text,
  p_price_cents_snapshot integer,
  p_children            jsonb  -- [{item_local_uuid, product_id, variant_id, quantity, product_name_snapshot, variant_name_snapshot, note_text, modifiers: [{modifier_id, name_snapshot}]}]
) returns uuid  -- the komanda_combos.id
```

The RPC inserts the `komanda_combos` row, every child `komanda_items` row, and every modifier in a single transaction.

**Offline path** — new mutation type `add_combo`:
- Payload mirrors the RPC arguments
- Optimistic: write `komanda_combos` row + N `komanda_items` to TanStack cache
- Sync handler resolves `komanda_id` from local→server map, calls the RPC, stores combo `local_uuid → server_id` mapping plus per-child mappings

### Remove combo from komanda
- Mutation `remove_combo(combo_id)`
- Online: `DELETE FROM komanda_combos WHERE id = $1` (FK cascades children + modifiers)
- Offline: queued; optimistic removes combo + children from cache

### Komanda close
No change to the close-day RPC. Existing total computation must include combo prices — update `useKomandasTotals` and the close screen total to sum `komanda_combos` separately and add to free-floating subtotal.

## Authorization (RLS)

| Table | Read | Write |
|---|---|---|
| `combos` | same org members | `can.manageMenu` (admin/cashier) |
| `combo_items` | same org members | `can.manageMenu` |
| `komanda_combos` | same org members | `can.workKomanda` (admin/cashier/waiter) |

## Error states

| Case | UX |
|---|---|
| Combo deactivated mid-shift | Hides from add-item picker; existing placements stay valid (combo_id can be set on `komanda_combos` even if `combos.active = false`) |
| Underlying product deleted from menu | `combo_items.product_id` references stay valid until a hard product delete cascades; in practice products only soft-deactivate. Combo composition shows the product as-is; if the product was hard-deleted, the row's product_id FK forces a NULL on the snapshot — show "(removed)" |
| Network failure on add_komanda_combo | Mutation goes to offline queue; banner reflects sync state |
| Stale combo definition (price changed between admin save and waiter add) | Snapshot wins — `name_snapshot`, `price_cents_snapshot`, `category_snapshot` lock at add time |
| Required modifier missing on a child | Configurator footer disabled with hint, same as today's add-item screen |

## Testing

**Unit**
- `aggregateAudit` — closed komanda with combos contributes correctly to total, byCategory, perWaiter
- Pure helper `groupItemsByCombo(items, combos)` — produces the right tree
- Komanda total computation including combos

**Integration (deferred, follow-up batch)**
- Define combo → add to komanda → close → audit shows correct totals
- Remove combo cascades children + modifiers
- Snapshot survives combo deletion after close

## Open questions

None. All resolved during brainstorming.

## Out of scope (deferred)

- Slot-based combos (waiter-pickable contents at order time)
- Combo discounts as a percentage
- Per-combo sales reports separate from product-level reports
- Drag-to-reorder in combo edit screen
- Combo image / icon
