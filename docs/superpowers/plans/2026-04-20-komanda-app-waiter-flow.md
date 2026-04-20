# Komanda App — Waiter Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete komanda-app v1 — waiters can open a new komanda, add items (with variants, modifiers, notes), manage status, close and charge with a PDF receipt, all working offline with writes syncing on reconnect.

**Architecture:** Builds on the Foundation plan. All waiter writes route through the mutation queue (`src/offline/queue.ts`); handlers in a new `src/offline/handlers/` directory call Insforge. PDF generation is local via `expo-print`.

**Tech Stack:** `expo-print`, `expo-sharing`, plus everything from the Foundation plan.

**Prerequisite:** Plan A (Foundation) is complete and merged. This plan assumes every file listed under "File Structure" in Plan A exists, the Insforge schema is applied, and at least one product has been seeded for manual testing.

**Companion spec:** [docs/superpowers/specs/2026-04-18-komanda-app-v1-design.md](../specs/2026-04-18-komanda-app-v1-design.md)

---

## File Structure

Files this plan creates or modifies:

```
app/
  (app)/
    komandas/
      index.tsx                          -- MODIFY: replace placeholder with real list
      new.tsx                            -- NEW: creates a komanda then redirects
      [id]/
        index.tsx                        -- NEW: detail screen
        add-item.tsx                     -- NEW: product → variant → qty → modifiers
        close.tsx                        -- NEW: payment method + confirm + share
src/
  domain/
    money.ts                             -- NEW: cents ↔ display formatter
    total.ts                             -- NEW: pure total calculator
    komandaNumber.ts                     -- NEW: offline-friendly identifier formatter
  insforge/queries/komandas.ts           -- NEW: komanda reads (list, by id, items)
  offline/handlers/index.ts              -- NEW: handler registry assembled from the below
  offline/handlers/createKomanda.ts      -- NEW
  offline/handlers/renameKomanda.ts      -- NEW
  offline/handlers/updateStatus.ts       -- NEW
  offline/handlers/addItem.ts            -- NEW
  offline/handlers/updateItem.ts         -- NEW
  offline/handlers/removeItem.ts         -- NEW
  offline/handlers/closeKomanda.ts       -- NEW
  offline/localStore.ts                  -- NEW: local-id → server-id map + optimistic rows
  offline/drain.ts                       -- NEW: useQueueDrain hook wiring processor + NetInfo
  mutations/useCreateKomanda.ts          -- NEW: thin React wrapper around enqueue
  mutations/useRenameKomanda.ts          -- NEW
  mutations/useUpdateStatus.ts           -- NEW
  mutations/useAddItem.ts                -- NEW
  mutations/useUpdateItem.ts             -- NEW
  mutations/useRemoveItem.ts             -- NEW
  mutations/useCloseKomanda.ts           -- NEW
  receipt/renderReceipt.ts               -- NEW: HTML template
  receipt/shareReceipt.ts                -- NEW: expo-print + expo-sharing
  components/StatusPill.tsx              -- NEW
  components/KomandaCard.tsx             -- NEW
  components/QuantityStepper.tsx         -- NEW
tests/
  domain/total.test.ts                   -- NEW
  domain/komandaNumber.test.ts           -- NEW
  domain/money.test.ts                   -- NEW
  offline/localStore.test.ts             -- NEW
  offline/handlers/createKomanda.test.ts -- NEW
  receipt/renderReceipt.test.ts          -- NEW
.maestro/
  sign-in-create-close.yaml              -- NEW
  offline-create-sync.yaml               -- NEW
README.md                                 -- MODIFY: update status section
```

---

## Task 1: Money formatter (pure)

**Files:**
- Create: `src/domain/money.ts`
- Create: `tests/domain/money.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/domain/money.test.ts`

```ts
import { formatMXN } from '@/domain/money';

describe('formatMXN', () => {
  it('formats integer cents as Mexican pesos', () => {
    expect(formatMXN(2500)).toBe('$25.00');
    expect(formatMXN(0)).toBe('$0.00');
    expect(formatMXN(12345)).toBe('$123.45');
  });
  it('handles negative values with a leading minus', () => {
    expect(formatMXN(-500)).toBe('-$5.00');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- money`
Expected: FAIL — "Cannot find module '@/domain/money'".

- [ ] **Step 3: Implement**

File: `src/domain/money.ts`

```ts
/**
 * Format integer cents as Mexican pesos, e.g. 2500 → "$25.00".
 * We don't use Intl because RN runtimes vary; the format is deterministic.
 */
export function formatMXN(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const major = Math.trunc(abs / 100);
  const minor = String(abs % 100).padStart(2, '0');
  return `${sign}$${major}.${minor}`;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- money`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/money.ts tests/domain/money.test.ts
git commit -m "feat(domain): formatMXN helper for integer cents"
```

---

## Task 2: Total calculator (pure)

**Files:**
- Create: `src/domain/total.ts`
- Create: `tests/domain/total.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/domain/total.test.ts`

```ts
import { calculateTotal } from '@/domain/total';

describe('calculateTotal', () => {
  it('returns 0 for an empty komanda', () => {
    expect(calculateTotal([])).toBe(0);
  });
  it('sums qty × unit_price_cents across items', () => {
    expect(
      calculateTotal([
        { quantity: 2, unit_price_cents: 2500 },
        { quantity: 1, unit_price_cents: 3000 },
        { quantity: 3, unit_price_cents: 1000 },
      ])
    ).toBe(11000);
  });
  it('ignores modifier and note fields (they do not affect price in v1)', () => {
    expect(
      calculateTotal([
        {
          quantity: 1,
          unit_price_cents: 2500,
          note_text: 'no cilantro',
          modifiers: [{ name_snapshot: 'extra salsa' }],
        } as any,
      ])
    ).toBe(2500);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- total`

- [ ] **Step 3: Implement**

File: `src/domain/total.ts`

```ts
export interface PricedItem {
  quantity: number;
  unit_price_cents: number;
}

export function calculateTotal(items: PricedItem[]): number {
  let total = 0;
  for (const item of items) {
    total += item.quantity * item.unit_price_cents;
  }
  return total;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- total`

- [ ] **Step 5: Commit**

```bash
git add src/domain/total.ts tests/domain/total.test.ts
git commit -m "feat(domain): pure calculateTotal"
```

---

## Task 3: Komanda identifier formatter (pure)

**Files:**
- Create: `src/domain/komandaNumber.ts`
- Create: `tests/domain/komandaNumber.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/domain/komandaNumber.test.ts`

```ts
import { displayIdentifier, formatYyyyMmDd } from '@/domain/komandaNumber';

describe('formatYyyyMmDd', () => {
  it('returns YYYYMMDD from a Date in local time', () => {
    expect(formatYyyyMmDd(new Date(2026, 3, 18))).toBe('20260418'); // April = 3
    expect(formatYyyyMmDd(new Date(2026, 11, 1))).toBe('20261201');
  });
});

describe('displayIdentifier', () => {
  it('returns the server number when present', () => {
    expect(
      displayIdentifier({ number: 'komanda-20260418-007', display_name: null, opened_at: '2026-04-18T14:32:00Z' })
    ).toBe('komanda-20260418-007');
  });
  it('falls back to "Ticket — <date time>" when number is null', () => {
    expect(
      displayIdentifier({ number: null, display_name: null, opened_at: '2026-04-18T14:32:00Z' })
    ).toMatch(/^Ticket — 2026-04-18/);
  });
  it('prefixes display_name when both are missing the number', () => {
    expect(
      displayIdentifier({ number: null, display_name: 'Table 5', opened_at: '2026-04-18T14:32:00Z' })
    ).toMatch(/Table 5/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- komandaNumber`

- [ ] **Step 3: Implement**

File: `src/domain/komandaNumber.ts`

```ts
export function formatYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export interface KomandaIdentity {
  number: string | null;
  display_name: string | null;
  opened_at: string; // ISO
}

/**
 * What to show on the komanda card + receipt.
 * If `number` is assigned, it wins. Otherwise build a human-readable fallback
 * so offline-created komandas still get a sensible identifier.
 */
export function displayIdentifier(k: KomandaIdentity): string {
  if (k.number) return k.number;
  const dt = new Date(k.opened_at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  return k.display_name
    ? `Ticket — ${stamp} — ${k.display_name}`
    : `Ticket — ${stamp}`;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- komandaNumber`

- [ ] **Step 5: Commit**

```bash
git add src/domain/komandaNumber.ts tests/domain/komandaNumber.test.ts
git commit -m "feat(domain): komanda identifier formatter with offline fallback"
```

---

## Task 4: Local-id → server-id map

Offline komandas exist client-side with `local_uuid`. When the `create_komanda` mutation syncs, the server returns the real id + number; subsequent queued mutations and UI references need to swap the local id out. This module owns that mapping.

**Files:**
- Create: `src/offline/localStore.ts`
- Create: `tests/offline/localStore.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/offline/localStore.test.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createLocalStore,
  rememberSync,
  resolveId,
  LOCAL_STORE_KEY,
} from '@/offline/localStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('localStore', () => {
  it('remembers local→server mappings and round-trips', async () => {
    const store = createLocalStore();
    await rememberSync(store, 'local-a', 'server-A');
    await rememberSync(store, 'local-b', 'server-B');
    expect(await resolveId(store, 'local-a')).toBe('server-A');
    expect(await resolveId(store, 'local-b')).toBe('server-B');
  });
  it('returns the input unchanged when no mapping exists', async () => {
    const store = createLocalStore();
    expect(await resolveId(store, 'never-mapped')).toBe('never-mapped');
  });
  it('persists across re-creation', async () => {
    const store = createLocalStore();
    await rememberSync(store, 'local-a', 'server-A');
    const store2 = createLocalStore();
    await new Promise((r) => setTimeout(r, 0));
    expect(await resolveId(store2, 'local-a')).toBe('server-A');
    expect(await AsyncStorage.getItem(LOCAL_STORE_KEY)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- localStore`

- [ ] **Step 3: Implement**

File: `src/offline/localStore.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCAL_STORE_KEY = '@komanda/local-ids/v1';

export interface LocalStore {
  map: () => Promise<Record<string, string>>;
  set: (next: Record<string, string>) => Promise<void>;
}

export function createLocalStore(): LocalStore {
  let memo: Record<string, string> | null = null;
  const hydrate = (async () => {
    const raw = await AsyncStorage.getItem(LOCAL_STORE_KEY);
    memo = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  })();

  return {
    async map() {
      if (!memo) await hydrate;
      return memo!;
    },
    async set(next) {
      memo = next;
      await AsyncStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(next));
    },
  };
}

export async function rememberSync(
  store: LocalStore,
  localId: string,
  serverId: string
): Promise<void> {
  const m = await store.map();
  await store.set({ ...m, [localId]: serverId });
}

export async function resolveId(store: LocalStore, id: string): Promise<string> {
  const m = await store.map();
  return m[id] ?? id;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- localStore`

- [ ] **Step 5: Commit**

```bash
git add src/offline/localStore.ts tests/offline/localStore.test.ts
git commit -m "feat(offline): local-id to server-id map"
```

---

## Task 5: Komanda read queries

**Files:**
- Create: `src/insforge/queries/komandas.ts`

- [ ] **Step 1: Implement**

File: `src/insforge/queries/komandas.ts`

```ts
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { KomandaRow, type KomandaRowT } from '@/insforge/schemas';

export async function fetchKomandasForDate(date: Date): Promise<KomandaRowT[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await insforge
    .from('komandas')
    .select('*')
    .gte('opened_at', start.toISOString())
    .lt('opened_at', end.toISOString())
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => KomandaRow.parse(r));
}

export async function fetchKomandaById(id: string): Promise<KomandaRowT | null> {
  const { data, error } = await insforge
    .from('komandas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return KomandaRow.parse(data);
}

export const KomandaItemRow = z.object({
  id: z.string().uuid(),
  komanda_id: z.string().uuid(),
  org_id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  variant_id: z.string().uuid().nullable(),
  quantity: z.number().int(),
  unit_price_cents: z.number().int(),
  product_name_snapshot: z.string(),
  variant_name_snapshot: z.string().nullable(),
  note_text: z.string().nullable(),
  created_at: z.string(),
});
export type KomandaItemRowT = z.infer<typeof KomandaItemRow>;

export const KomandaItemModifierRow = z.object({
  id: z.string().uuid(),
  komanda_item_id: z.string().uuid(),
  modifier_id: z.string().uuid().nullable(),
  name_snapshot: z.string(),
});
export type KomandaItemModifierRowT = z.infer<typeof KomandaItemModifierRow>;

export async function fetchItemsForKomanda(
  komandaId: string
): Promise<(KomandaItemRowT & { modifiers: KomandaItemModifierRowT[] })[]> {
  const { data: items, error } = await insforge
    .from('komanda_items')
    .select('*')
    .eq('komanda_id', komandaId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const parsedItems = (items ?? []).map((r) => KomandaItemRow.parse(r));
  if (parsedItems.length === 0) return [];

  const { data: mods, error: modErr } = await insforge
    .from('komanda_item_modifiers')
    .select('*')
    .in('komanda_item_id', parsedItems.map((i) => i.id));
  if (modErr) throw modErr;

  const parsedMods = (mods ?? []).map((r) => KomandaItemModifierRow.parse(r));
  const byItem = new Map<string, KomandaItemModifierRowT[]>();
  for (const m of parsedMods) {
    const arr = byItem.get(m.komanda_item_id) ?? [];
    arr.push(m);
    byItem.set(m.komanda_item_id, arr);
  }
  return parsedItems.map((i) => ({ ...i, modifiers: byItem.get(i.id) ?? [] }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/insforge/queries/komandas.ts
git commit -m "feat(insforge): komanda read queries (list-by-date, by-id, items)"
```

---

## Task 6: Mutation handlers — createKomanda (with counter RPC)

Each handler takes a queued mutation and performs the actual Insforge write. `createKomanda` is the most complex because it (a) calls the counter RPC to allocate the number, (b) inserts the row with `local_uuid`, and (c) records the local→server id mapping.

**Files:**
- Create: `src/offline/handlers/createKomanda.ts`
- Create: `tests/offline/handlers/createKomanda.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/offline/handlers/createKomanda.test.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createKomandaHandler } from '@/offline/handlers/createKomanda';
import { createLocalStore, resolveId } from '@/offline/localStore';

jest.mock('@/insforge/client', () => ({
  insforge: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));
import { insforge } from '@/insforge/client';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('createKomandaHandler', () => {
  it('allocates a number via RPC, inserts the komanda, and records the id mapping', async () => {
    (insforge.rpc as jest.Mock).mockResolvedValue({
      data: 'komanda-20260420-001',
      error: null,
    });
    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'server-id-1',
        org_id: 'org-1',
        number: 'komanda-20260420-001',
        display_name: null,
        status: 'open',
        opened_by_auth_user_id: 'user-1',
        opened_at: '2026-04-20T00:00:00.000Z',
        closed_at: null,
        closed_by_auth_user_id: null,
        payment_method: null,
        total_cents: null,
        local_uuid: 'local-1',
      },
      error: null,
    });
    (insforge.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ single }),
      }),
    });

    const localStore = createLocalStore();
    const handle = createKomandaHandler({ localStore });

    await handle({
      id: 'mut-1',
      type: 'create_komanda',
      payload: { local_uuid: 'local-1', display_name: null, opened_at: '2026-04-20T00:00:00.000Z' },
      createdAt: '2026-04-20T00:00:00.000Z',
      attemptCount: 0,
      lastError: null,
    });

    expect(insforge.rpc).toHaveBeenCalledWith('next_komanda_number', {
      p_date: '2026-04-20',
    });
    expect(await resolveId(localStore, 'local-1')).toBe('server-id-1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- createKomanda`

- [ ] **Step 3: Implement**

File: `src/offline/handlers/createKomanda.ts`

```ts
import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { rememberSync, type LocalStore } from '@/offline/localStore';

export interface CreateKomandaPayload {
  local_uuid: string;
  display_name: string | null;
  opened_at: string; // ISO
}

function yyyyMmDd(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createKomandaHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as CreateKomandaPayload;

    const { data: number, error: rpcErr } = await insforge.rpc('next_komanda_number', {
      p_date: yyyyMmDd(payload.opened_at),
    });
    if (rpcErr) throw rpcErr;

    const { data, error } = await insforge
      .from('komandas')
      .insert({
        number,
        display_name: payload.display_name,
        status: 'open',
        opened_at: payload.opened_at,
        local_uuid: payload.local_uuid,
        // org_id + opened_by_auth_user_id + counter's org scope are all server-enforced
        // via RLS / current_org_id() so we don't pass them from the client.
      })
      .select('*')
      .single();
    if (error) throw error;

    await rememberSync(deps.localStore, payload.local_uuid, data.id);
  };
}
```

> Note on `org_id` and `opened_by_auth_user_id`: the RLS policy `with check (org_id = public.current_org_id())` requires `org_id` to be passed. Update the SQL schema to add a `before insert` trigger that sets `org_id = current_org_id()` and `opened_by_auth_user_id = auth.uid()` when omitted, OR pass them from the client. Pick ONE and keep it consistent; the recommended approach is a trigger so the client stays simple — see the next task.

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- createKomanda`

- [ ] **Step 5: Commit**

```bash
git add src/offline/handlers/createKomanda.ts tests/offline/handlers/createKomanda.test.ts
git commit -m "feat(offline): createKomanda handler with counter RPC + id mapping"
```

---

## Task 7: DB trigger — auto-fill org_id and opened_by_auth_user_id

**Files:**
- Create: `supabase-sql/0005_komanda_defaults.sql`

- [ ] **Step 1: Write SQL**

File: `supabase-sql/0005_komanda_defaults.sql`

```sql
create or replace function public.set_komanda_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.current_org_id();
  end if;
  if new.opened_by_auth_user_id is null then
    new.opened_by_auth_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_komandas_defaults on public.komandas;
create trigger trg_komandas_defaults
  before insert on public.komandas
  for each row execute function public.set_komanda_defaults();

-- Same for komanda_items (org_id only).
create or replace function public.set_komanda_item_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_komanda_items_defaults on public.komanda_items;
create trigger trg_komanda_items_defaults
  before insert on public.komanda_items
  for each row execute function public.set_komanda_item_defaults();
```

- [ ] **Step 2: Apply migration**

Run: `npx @insforge/cli db execute --file supabase-sql/0005_komanda_defaults.sql`

- [ ] **Step 3: Commit**

```bash
git add supabase-sql/0005_komanda_defaults.sql
git commit -m "feat(db): before-insert triggers to auto-fill org_id and opened_by"
```

---

## Task 8: Remaining mutation handlers

**Files:**
- Create: `src/offline/handlers/renameKomanda.ts`
- Create: `src/offline/handlers/updateStatus.ts`
- Create: `src/offline/handlers/addItem.ts`
- Create: `src/offline/handlers/updateItem.ts`
- Create: `src/offline/handlers/removeItem.ts`
- Create: `src/offline/handlers/closeKomanda.ts`
- Create: `src/offline/handlers/index.ts`

- [ ] **Step 1: Write `renameKomanda.ts`**

File: `src/offline/handlers/renameKomanda.ts`

```ts
import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface RenameKomandaPayload {
  komanda_id: string; // may be a local_uuid
  display_name: string | null;
}

export function renameKomandaHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as RenameKomandaPayload;
    const id = await resolveId(deps.localStore, payload.komanda_id);
    const { error } = await insforge
      .from('komandas')
      .update({ display_name: payload.display_name })
      .eq('id', id);
    if (error) throw error;
  };
}
```

- [ ] **Step 2: Write `updateStatus.ts`**

File: `src/offline/handlers/updateStatus.ts`

```ts
import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import type { KomandaStatusT } from '@/insforge/schemas';

export interface UpdateStatusPayload {
  komanda_id: string;
  status: KomandaStatusT;
}

export function updateStatusHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as UpdateStatusPayload;
    const id = await resolveId(deps.localStore, payload.komanda_id);
    const { error } = await insforge
      .from('komandas')
      .update({ status: payload.status })
      .eq('id', id);
    if (error) throw error;
  };
}
```

- [ ] **Step 3: Write `addItem.ts`**

File: `src/offline/handlers/addItem.ts`

```ts
import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { rememberSync, resolveId, type LocalStore } from '@/offline/localStore';

export interface AddItemPayload {
  item_local_uuid: string;
  komanda_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price_cents: number;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  note_text: string | null;
  modifiers: Array<{ modifier_id: string | null; name_snapshot: string }>;
}

export function addItemHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as AddItemPayload;
    const komandaId = await resolveId(deps.localStore, p.komanda_id);

    const { data: inserted, error } = await insforge
      .from('komanda_items')
      .insert({
        komanda_id: komandaId,
        product_id: p.product_id,
        variant_id: p.variant_id,
        quantity: p.quantity,
        unit_price_cents: p.unit_price_cents,
        product_name_snapshot: p.product_name_snapshot,
        variant_name_snapshot: p.variant_name_snapshot,
        note_text: p.note_text,
      })
      .select('*')
      .single();
    if (error) throw error;

    await rememberSync(deps.localStore, p.item_local_uuid, inserted.id);

    if (p.modifiers.length > 0) {
      const { error: modErr } = await insforge
        .from('komanda_item_modifiers')
        .insert(
          p.modifiers.map((mod) => ({
            komanda_item_id: inserted.id,
            modifier_id: mod.modifier_id,
            name_snapshot: mod.name_snapshot,
          }))
        );
      if (modErr) throw modErr;
    }
  };
}
```

- [ ] **Step 4: Write `updateItem.ts`**

File: `src/offline/handlers/updateItem.ts`

```ts
import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface UpdateItemPayload {
  item_id: string;           // local or server
  quantity?: number;
  note_text?: string | null;
}

export function updateItemHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as UpdateItemPayload;
    const id = await resolveId(deps.localStore, p.item_id);
    const patch: Record<string, unknown> = {};
    if (p.quantity !== undefined) patch.quantity = p.quantity;
    if (p.note_text !== undefined) patch.note_text = p.note_text;
    if (Object.keys(patch).length === 0) return;
    const { error } = await insforge.from('komanda_items').update(patch).eq('id', id);
    if (error) throw error;
  };
}
```

- [ ] **Step 5: Write `removeItem.ts`**

File: `src/offline/handlers/removeItem.ts`

```ts
import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';

export interface RemoveItemPayload { item_id: string; }

export function removeItemHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as RemoveItemPayload;
    const id = await resolveId(deps.localStore, p.item_id);
    const { error } = await insforge.from('komanda_items').delete().eq('id', id);
    if (error) throw error;
  };
}
```

- [ ] **Step 6: Write `closeKomanda.ts`**

File: `src/offline/handlers/closeKomanda.ts`

```ts
import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { resolveId, type LocalStore } from '@/offline/localStore';
import type { PaymentMethodT } from '@/insforge/schemas';

export interface CloseKomandaPayload {
  komanda_id: string;
  payment_method: PaymentMethodT;
  total_cents: number;
  closed_at: string;
}

export function closeKomandaHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as CloseKomandaPayload;
    const id = await resolveId(deps.localStore, p.komanda_id);
    const { error } = await insforge
      .from('komandas')
      .update({
        status: 'closed',
        payment_method: p.payment_method,
        total_cents: p.total_cents,
        closed_at: p.closed_at,
        // closed_by_auth_user_id: server trigger could set this, but we pass auth.uid()
        // implicitly via a trigger if desired; for v1 leave null if SDK can't derive it.
      })
      .eq('id', id);
    if (error) throw error;
  };
}
```

- [ ] **Step 7: Write the registry**

File: `src/offline/handlers/index.ts`

```ts
import type { HandlerRegistry } from '@/offline/processor';
import { createLocalStore } from '@/offline/localStore';
import { createKomandaHandler } from './createKomanda';
import { renameKomandaHandler } from './renameKomanda';
import { updateStatusHandler } from './updateStatus';
import { addItemHandler } from './addItem';
import { updateItemHandler } from './updateItem';
import { removeItemHandler } from './removeItem';
import { closeKomandaHandler } from './closeKomanda';

export const localStore = createLocalStore();

export const handlers: HandlerRegistry = {
  create_komanda: createKomandaHandler({ localStore }),
  rename_komanda: renameKomandaHandler({ localStore }),
  update_status: updateStatusHandler({ localStore }),
  add_item: addItemHandler({ localStore }),
  update_item: updateItemHandler({ localStore }),
  remove_item: removeItemHandler({ localStore }),
  close_komanda: closeKomandaHandler({ localStore }),
};
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add src/offline/handlers/
git commit -m "feat(offline): handlers for all 7 mutation types"
```

---

## Task 9: Queue drain hook

**Files:**
- Create: `src/offline/drain.ts`
- Modify: `src/offline/handlers/index.ts` (export the shared queueStore too)

- [ ] **Step 1: Export a shared queue store from handlers module**

Modify `src/offline/handlers/index.ts` — add at the top, next to `localStore`:

```ts
import { createQueueStore } from '@/offline/queue';
export const queueStore = createQueueStore();
```

- [ ] **Step 2: Write the drain hook**

File: `src/offline/drain.ts`

```ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnline } from './network';
import { drainQueue } from './processor';
import { handlers, queueStore } from './handlers';

/**
 * Mount once at app root. When connectivity returns, drain the mutation queue
 * and invalidate queries so optimistic UI reconciles with server state.
 */
export function useQueueDrain() {
  const online = useOnline();
  const qc = useQueryClient();
  const draining = useRef(false);

  useEffect(() => {
    if (online !== true) return;
    if (draining.current) return;
    draining.current = true;

    (async () => {
      try {
        await drainQueue(queueStore, handlers);
        // Invalidate every query so any optimistic deltas reconcile.
        await qc.invalidateQueries();
      } catch {
        // drainQueue already stores errors on each mutation; nothing more to do here.
      } finally {
        draining.current = false;
      }
    })();
  }, [online, qc]);
}
```

- [ ] **Step 3: Mount the hook in the root layout**

Modify `app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { QueryProvider } from '@/offline/QueryProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useQueueDrain } from '@/offline/drain';

function QueueBoot() {
  useQueueDrain();
  return null;
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <QueueBoot />
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

- [ ] **Step 4: Commit**

```bash
git add src/offline/drain.ts src/offline/handlers/index.ts app/_layout.tsx
git commit -m "feat(offline): useQueueDrain hook wired at root layout"
```

---

## Task 10: Mutation wrappers (React hooks that enqueue)

Each `useX` hook: optimistically writes into the Query cache, enqueues the mutation, and on `drain` the server-returned row replaces the optimistic one.

**Files:**
- Create: `src/mutations/useCreateKomanda.ts`
- Create: `src/mutations/useRenameKomanda.ts`
- Create: `src/mutations/useUpdateStatus.ts`
- Create: `src/mutations/useAddItem.ts`
- Create: `src/mutations/useUpdateItem.ts`
- Create: `src/mutations/useRemoveItem.ts`
- Create: `src/mutations/useCloseKomanda.ts`

- [ ] **Step 1: Write `useCreateKomanda.ts`**

File: `src/mutations/useCreateKomanda.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import 'react-native-get-random-values';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { useSession } from '@/insforge/session';
import type { KomandaRowT } from '@/insforge/schemas';

function uuid(): string {
  // RN polyfill-safe.
  return (globalThis.crypto as any).randomUUID
    ? (globalThis.crypto as any).randomUUID()
    : ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
        (c ^ ((globalThis.crypto as any).getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
}

export function useCreateKomanda() {
  const qc = useQueryClient();
  const session = useSession();

  return useMutation({
    mutationFn: async (input: { display_name: string | null }) => {
      if (session.status !== 'signed-in') throw new Error('not_signed_in');
      const local_uuid = uuid();
      const opened_at = new Date().toISOString();

      // Optimistic row.
      const optimistic: KomandaRowT = {
        id: local_uuid, // use local_uuid as the id until resolved
        org_id: '00000000-0000-0000-0000-000000000000',
        number: null,
        display_name: input.display_name,
        status: 'open',
        opened_by_auth_user_id: session.session.userId,
        opened_at,
        closed_at: null,
        closed_by_auth_user_id: null,
        payment_method: null,
        total_cents: null,
        local_uuid,
      };

      qc.setQueryData<KomandaRowT[]>(['komandas', 'today'], (prev) => [optimistic, ...(prev ?? [])]);

      await enqueue(queueStore, {
        type: 'create_komanda',
        payload: { local_uuid, display_name: input.display_name, opened_at },
      });

      return optimistic;
    },
  });
}
```

- [ ] **Step 2: Write `useRenameKomanda.ts`**

File: `src/mutations/useRenameKomanda.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { KomandaRowT } from '@/insforge/schemas';

export function useRenameKomanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { komanda_id: string; display_name: string | null }) => {
      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev ? { ...prev, display_name: input.display_name } : prev
      );
      await enqueue(queueStore, {
        type: 'rename_komanda',
        payload: input,
      });
    },
  });
}
```

- [ ] **Step 3: Write `useUpdateStatus.ts`**

File: `src/mutations/useUpdateStatus.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { KomandaRowT, KomandaStatusT } from '@/insforge/schemas';

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { komanda_id: string; status: KomandaStatusT }) => {
      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev ? { ...prev, status: input.status } : prev
      );
      qc.setQueryData<KomandaRowT[]>(['komandas', 'today'], (prev) =>
        prev?.map((k) => (k.id === input.komanda_id ? { ...k, status: input.status } : k))
      );
      await enqueue(queueStore, {
        type: 'update_status',
        payload: input,
      });
    },
  });
}
```

- [ ] **Step 4: Write `useAddItem.ts`**

File: `src/mutations/useAddItem.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import 'react-native-get-random-values';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { AddItemPayload } from '@/offline/handlers/addItem';

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<AddItemPayload, 'item_local_uuid'>) => {
      const item_local_uuid = (globalThis.crypto as any).randomUUID();
      await enqueue(queueStore, {
        type: 'add_item',
        payload: { ...input, item_local_uuid },
      });
      await qc.invalidateQueries({ queryKey: ['komanda', input.komanda_id, 'items'] });
      return item_local_uuid;
    },
  });
}
```

- [ ] **Step 5: Write `useUpdateItem.ts`**

File: `src/mutations/useUpdateItem.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { UpdateItemPayload } from '@/offline/handlers/updateItem';

export function useUpdateItem(komandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateItemPayload) => {
      await enqueue(queueStore, { type: 'update_item', payload: input });
      await qc.invalidateQueries({ queryKey: ['komanda', komandaId, 'items'] });
    },
  });
}
```

- [ ] **Step 6: Write `useRemoveItem.ts`**

File: `src/mutations/useRemoveItem.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';

export function useRemoveItem(komandaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item_id: string) => {
      await enqueue(queueStore, { type: 'remove_item', payload: { item_id } });
      await qc.invalidateQueries({ queryKey: ['komanda', komandaId, 'items'] });
    },
  });
}
```

- [ ] **Step 7: Write `useCloseKomanda.ts`**

File: `src/mutations/useCloseKomanda.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { CloseKomandaPayload } from '@/offline/handlers/closeKomanda';
import type { KomandaRowT } from '@/insforge/schemas';

export function useCloseKomanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseKomandaPayload) => {
      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev
          ? {
              ...prev,
              status: 'closed',
              payment_method: input.payment_method,
              total_cents: input.total_cents,
              closed_at: input.closed_at,
            }
          : prev
      );
      qc.setQueryData<KomandaRowT[]>(['komandas', 'today'], (prev) =>
        prev?.map((k) =>
          k.id === input.komanda_id
            ? {
                ...k,
                status: 'closed',
                payment_method: input.payment_method,
                total_cents: input.total_cents,
                closed_at: input.closed_at,
              }
            : k
        )
      );
      await enqueue(queueStore, { type: 'close_komanda', payload: input });
    },
  });
}
```

- [ ] **Step 8: Install the RN UUID polyfill**

Run: `npx expo install react-native-get-random-values`

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 10: Commit**

```bash
git add src/mutations/ package.json package-lock.json
git commit -m "feat(mutations): React wrappers for all seven queue mutations"
```

---

## Task 11: Shared UI components

**Files:**
- Create: `src/components/StatusPill.tsx`
- Create: `src/components/KomandaCard.tsx`
- Create: `src/components/QuantityStepper.tsx`

- [ ] **Step 1: Write `StatusPill.tsx`**

File: `src/components/StatusPill.tsx`

```tsx
import { StyleSheet, Text, View } from 'react-native';
import type { KomandaStatusT } from '@/insforge/schemas';

const COLORS: Record<KomandaStatusT, { bg: string; fg: string }> = {
  open:    { bg: '#dbeafe', fg: '#1e3a8a' },
  pending: { bg: '#fef3c7', fg: '#78350f' },
  served:  { bg: '#dcfce7', fg: '#14532d' },
  closed:  { bg: '#e5e5e5', fg: '#262626' },
};

export function StatusPill({ status }: { status: KomandaStatusT }) {
  const c = COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
```

- [ ] **Step 2: Write `KomandaCard.tsx`**

File: `src/components/KomandaCard.tsx`

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusPill } from './StatusPill';
import { displayIdentifier } from '@/domain/komandaNumber';
import { formatMXN } from '@/domain/money';
import type { KomandaRowT } from '@/insforge/schemas';

export function KomandaCard({
  k,
  itemCount,
  runningTotalCents,
  onPress,
  syncedServerSide,
}: {
  k: KomandaRowT;
  itemCount: number;
  runningTotalCents: number;
  onPress: () => void;
  syncedServerSide: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.id}>{displayIdentifier(k)}</Text>
        <StatusPill status={k.status} />
      </View>
      {k.display_name ? <Text style={styles.display}>{k.display_name}</Text> : null}
      <View style={styles.row}>
        <Text style={styles.meta}>
          {itemCount} item{itemCount === 1 ? '' : 's'}
          {syncedServerSide ? '' : ' · ☁︎ pending'}
        </Text>
        <Text style={styles.total}>{formatMXN(runningTotalCents)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, backgroundColor: 'white', borderRadius: 10, gap: 6, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  id: { fontSize: 14, fontWeight: '600' },
  display: { fontSize: 13, color: '#404040' },
  meta: { fontSize: 12, color: '#737373' },
  total: { fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 3: Write `QuantityStepper.tsx`**

File: `src/components/QuantityStepper.tsx`

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={[styles.btn, value <= min && styles.btnDisabled]}
      >
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.btn, value >= max && styles.btnDisabled]}
      >
        <Text style={styles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: 'white', fontSize: 22, fontWeight: '700' },
  value: { fontSize: 20, fontWeight: '700', minWidth: 32, textAlign: 'center' },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat(ui): StatusPill, KomandaCard, QuantityStepper"
```

---

## Task 12: Komandas list screen (real)

**Files:**
- Modify: `app/(app)/komandas/index.tsx` (replace smoke-test placeholder)

- [ ] **Step 1: Replace the placeholder with the real list**

File: `app/(app)/komandas/index.tsx`

```tsx
import { useMemo } from 'react';
import { Link, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { fetchKomandasForDate } from '@/insforge/queries/komandas';
import { KomandaCard } from '@/components/KomandaCard';
import { calculateTotal } from '@/domain/total';
import { fetchItemsForKomanda } from '@/insforge/queries/komandas';

export default function KomandasList() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['komandas', 'today'],
    queryFn: () => fetchKomandasForDate(today),
    staleTime: 1000 * 10,
  });

  return (
    <View style={styles.root}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(k) => k.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<Text style={styles.empty}>No komandas yet today.</Text>}
          renderItem={({ item }) => (
            <KomandaRow k={item} onPress={() => router.push(`/(app)/komandas/${item.id}`)} />
          )}
        />
      )}
      <Link href="/(app)/komandas/new" asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+ New komanda</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

function KomandaRow({
  k,
  onPress,
}: {
  k: Parameters<typeof KomandaCard>[0]['k'];
  onPress: () => void;
}) {
  const items = useQuery({
    queryKey: ['komanda', k.id, 'items'],
    queryFn: () => fetchItemsForKomanda(k.id),
    enabled: k.number !== null, // optimistic local-only rows won't have any server items
  });
  const total = calculateTotal(items.data ?? []);
  return (
    <KomandaCard
      k={k}
      itemCount={items.data?.length ?? 0}
      runningTotalCents={total}
      onPress={onPress}
      syncedServerSide={k.number !== null}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f5' },
  list: { padding: 16, paddingBottom: 96 },
  empty: { textAlign: 'center', color: '#737373', marginTop: 48 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  fabText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/komandas/index.tsx
git commit -m "feat(app): real komandas list screen"
```

---

## Task 13: New komanda screen

**Files:**
- Create: `app/(app)/komandas/new.tsx`

- [ ] **Step 1: Write the screen**

File: `app/(app)/komandas/new.tsx`

```tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useCreateKomanda } from '@/mutations/useCreateKomanda';

export default function NewKomanda() {
  const router = useRouter();
  const create = useCreateKomanda();
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    // If the user didn't tap the rename field, auto-create on mount.
  }, [started]);

  async function go() {
    const row = await create.mutateAsync({ display_name: name.trim() || null });
    router.replace(`/(app)/komandas/${row.id}`);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Text style={styles.title}>New komanda</Text>
      <Text style={styles.label}>Optional rename (e.g. "Table 5")</Text>
      <TextInput
        placeholder="Leave empty for auto number"
        value={name}
        onChangeText={(v) => { setName(v); setStarted(true); }}
        style={styles.input}
      />
      <TouchableOpacity onPress={go} disabled={create.isPending} style={[styles.button, create.isPending && styles.buttonDisabled]}>
        {create.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Open komanda</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: 'white', gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 12, color: '#737373', marginTop: 12, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111827', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { color: '#737373', fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/komandas/new.tsx
git commit -m "feat(app): new-komanda screen with optional rename"
```

---

## Task 14: Komanda detail screen

**Files:**
- Create: `app/(app)/komandas/[id]/index.tsx`

- [ ] **Step 1: Write the detail screen**

File: `app/(app)/komandas/[id]/index.tsx`

```tsx
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchKomandaById, fetchItemsForKomanda } from '@/insforge/queries/komandas';
import { calculateTotal } from '@/domain/total';
import { formatMXN } from '@/domain/money';
import { displayIdentifier } from '@/domain/komandaNumber';
import { StatusPill } from '@/components/StatusPill';
import { useUpdateStatus } from '@/mutations/useUpdateStatus';
import { useRemoveItem } from '@/mutations/useRemoveItem';
import type { KomandaStatusT } from '@/insforge/schemas';

const STATUSES: KomandaStatusT[] = ['open', 'pending', 'served', 'closed'];

export default function KomandaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const komanda = useQuery({ queryKey: ['komanda', id], queryFn: () => fetchKomandaById(id!), enabled: !!id });
  const items = useQuery({ queryKey: ['komanda', id, 'items'], queryFn: () => fetchItemsForKomanda(id!), enabled: !!id });
  const updateStatus = useUpdateStatus();
  const removeItem = useRemoveItem(id!);

  if (!id || komanda.isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!komanda.data) return <Text style={styles.missing}>Komanda not found.</Text>;

  const closed = komanda.data.status === 'closed';
  const total = calculateTotal(items.data ?? []);

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.header}>
        <Text style={styles.id}>{displayIdentifier(komanda.data)}</Text>
        <StatusPill status={komanda.data.status} />
      </View>
      {komanda.data.display_name ? <Text style={styles.display}>{komanda.data.display_name}</Text> : null}

      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            disabled={closed}
            onPress={() => updateStatus.mutate({ komanda_id: id, status: s })}
            style={[
              styles.statusChip,
              komanda.data!.status === s && styles.statusChipActive,
              closed && styles.statusChipDisabled,
            ]}
          >
            <Text style={[styles.statusChipText, komanda.data!.status === s && styles.statusChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.itemsSection}>
        <Text style={styles.sectionHeader}>Items</Text>
        {items.data?.length ? (
          items.data.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <Text style={styles.itemQty}>{it.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {it.product_name_snapshot}
                  {it.variant_name_snapshot ? ` (${it.variant_name_snapshot})` : ''}
                </Text>
                {it.modifiers.length > 0 ? (
                  <Text style={styles.itemMods}>· {it.modifiers.map((m) => m.name_snapshot).join(' · ')}</Text>
                ) : null}
                {it.note_text ? <Text style={styles.itemNote}>{it.note_text}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>{formatMXN(it.quantity * it.unit_price_cents)}</Text>
              {!closed ? (
                <TouchableOpacity onPress={() => removeItem.mutate(it.id)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No items yet.</Text>
        )}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatMXN(total)}</Text>
      </View>
      <Text style={styles.ivaNote}>IVA incluido</Text>

      {!closed ? (
        <>
          <Link href={`/(app)/komandas/${id}/add-item`} asChild>
            <TouchableOpacity style={styles.primary}>
              <Text style={styles.primaryText}>Add item</Text>
            </TouchableOpacity>
          </Link>
          <Link href={`/(app)/komandas/${id}/close`} asChild>
            <TouchableOpacity
              disabled={(items.data?.length ?? 0) === 0}
              style={[styles.secondary, (items.data?.length ?? 0) === 0 && styles.secondaryDisabled]}
            >
              <Text style={styles.secondaryText}>Close &amp; charge</Text>
            </TouchableOpacity>
          </Link>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12 },
  missing: { padding: 24, fontSize: 16, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  id: { fontSize: 18, fontWeight: '700' },
  display: { fontSize: 14, color: '#404040' },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#e5e5e5' },
  statusChipActive: { backgroundColor: '#111827' },
  statusChipDisabled: { opacity: 0.5 },
  statusChipText: { fontSize: 13, color: '#404040', textTransform: 'capitalize' },
  statusChipTextActive: { color: 'white', fontWeight: '700' },
  itemsSection: { marginTop: 8, backgroundColor: 'white', borderRadius: 10, padding: 12 },
  sectionHeader: { fontSize: 12, color: '#737373', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e5e5' },
  itemQty: { fontSize: 16, fontWeight: '700', width: 28 },
  itemName: { fontSize: 15 },
  itemMods: { fontSize: 12, color: '#737373' },
  itemNote: { fontSize: 12, color: '#737373', fontStyle: 'italic' },
  itemPrice: { fontSize: 15, fontWeight: '600' },
  removeBtn: { paddingHorizontal: 8 },
  removeBtnText: { fontSize: 20, color: '#dc2626' },
  empty: { color: '#737373', fontStyle: 'italic', paddingVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  totalLabel: { fontSize: 18, fontWeight: '600' },
  total: { fontSize: 22, fontWeight: '800' },
  ivaNote: { fontSize: 11, color: '#737373', textAlign: 'right' },
  primary: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryDisabled: { opacity: 0.4 },
  secondaryText: { color: '#111827', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/komandas/\[id\]/index.tsx
git commit -m "feat(app): komanda detail screen with status + items + totals"
```

---

## Task 15: Add-item screen

**Files:**
- Create: `app/(app)/komandas/[id]/add-item.tsx`

- [ ] **Step 1: Write the screen**

File: `app/(app)/komandas/[id]/add-item.tsx`

```tsx
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchProducts, fetchVariants, fetchModifiers } from '@/insforge/queries/menu';
import { QuantityStepper } from '@/components/QuantityStepper';
import { formatMXN } from '@/domain/money';
import { useAddItem } from '@/mutations/useAddItem';
import type { ProductRowT, VariantRowT, ModifierRowT } from '@/insforge/schemas';

type Step = 'product' | 'variant' | 'customize';

export default function AddItem() {
  const { id: komandaId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const variants = useQuery({ queryKey: ['variants'], queryFn: fetchVariants });
  const modifiers = useQuery({ queryKey: ['modifiers'], queryFn: fetchModifiers });
  const addItem = useAddItem();

  const [step, setStep] = useState<Step>('product');
  const [product, setProduct] = useState<ProductRowT | null>(null);
  const [variant, setVariant] = useState<VariantRowT | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [toggledMods, setToggledMods] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  const productVariants = useMemo(
    () => (product ? variants.data?.filter((v) => v.product_id === product.id) ?? [] : []),
    [product, variants.data]
  );

  function pickProduct(p: ProductRowT) {
    setProduct(p);
    setVariant(null);
    const vs = variants.data?.filter((v) => v.product_id === p.id) ?? [];
    setStep(vs.length > 0 ? 'variant' : 'customize');
  }

  async function confirm() {
    if (!product || !komandaId) return;
    const chosenMods: ModifierRowT[] =
      modifiers.data?.filter((m) => toggledMods.has(m.id)) ?? [];
    await addItem.mutateAsync({
      komanda_id: komandaId,
      product_id: product.id,
      variant_id: variant?.id ?? null,
      quantity,
      unit_price_cents: product.price_cents,
      product_name_snapshot: product.name,
      variant_name_snapshot: variant?.name ?? null,
      note_text: note.trim() || null,
      modifiers: chosenMods.map((m) => ({ modifier_id: m.id, name_snapshot: m.name })),
    });
    router.back();
  }

  if (products.isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;

  if (step === 'product') {
    return (
      <FlatList
        data={products.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.grid}
        numColumns={2}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => pickProduct(item)} style={styles.productCard}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productPrice}>{formatMXN(item.price_cents)}</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  if (step === 'variant' && product) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{product.name} — pick variant</Text>
        <ScrollView contentContainerStyle={styles.variantList}>
          {productVariants.map((v) => (
            <TouchableOpacity
              key={v.id}
              onPress={() => { setVariant(v); setStep('customize'); }}
              style={styles.variantChip}
            >
              <Text style={styles.variantText}>{v.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // customize
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>
        {product?.name}{variant ? ` — ${variant.name}` : ''}
      </Text>
      <Text style={styles.label}>Quantity</Text>
      <QuantityStepper value={quantity} onChange={setQuantity} />
      <Text style={styles.label}>Modifiers</Text>
      <View style={styles.modRow}>
        {(modifiers.data ?? []).map((m) => {
          const on = toggledMods.has(m.id);
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => {
                const next = new Set(toggledMods);
                if (on) next.delete(m.id); else next.add(m.id);
                setToggledMods(next);
              }}
              style={[styles.modChip, on && styles.modChipActive]}
            >
              <Text style={[styles.modText, on && styles.modTextActive]}>{m.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.label}>Note</Text>
      <TextInput
        placeholder="e.g. extra salsa"
        value={note}
        onChangeText={setNote}
        style={styles.input}
      />
      <TouchableOpacity onPress={confirm} disabled={addItem.isPending} style={styles.primary}>
        <Text style={styles.primaryText}>
          Add to komanda · {formatMXN((product?.price_cents ?? 0) * quantity)}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { padding: 12, gap: 8 },
  productCard: { flex: 1, padding: 12, backgroundColor: 'white', borderRadius: 10, marginBottom: 8 },
  productName: { fontSize: 15, fontWeight: '600' },
  productPrice: { fontSize: 14, color: '#404040', marginTop: 4 },
  screen: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 12, color: '#737373', textTransform: 'uppercase', marginTop: 12 },
  variantList: { gap: 8 },
  variantChip: { padding: 14, backgroundColor: 'white', borderRadius: 10 },
  variantText: { fontSize: 16 },
  modRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#e5e5e5', borderRadius: 999 },
  modChipActive: { backgroundColor: '#111827' },
  modText: { fontSize: 13, color: '#404040' },
  modTextActive: { color: 'white', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, padding: 12, fontSize: 16 },
  primary: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/komandas/\[id\]/add-item.tsx
git commit -m "feat(app): add-item screen (product → variant → qty + mods + note)"
```

---

## Task 16: Receipt HTML template (pure)

**Files:**
- Create: `src/receipt/renderReceipt.ts`
- Create: `tests/receipt/renderReceipt.test.ts`

- [ ] **Step 1: Write the failing test**

File: `tests/receipt/renderReceipt.test.ts`

```ts
import { renderReceipt } from '@/receipt/renderReceipt';

describe('renderReceipt', () => {
  it('produces HTML with org name, identifier, items, total, and payment label', () => {
    const html = renderReceipt({
      orgName: 'Tacos El Güero',
      identifier: 'komanda-20260420-007',
      waiterName: 'Juan',
      openedAtIso: '2026-04-20T14:32:00Z',
      items: [
        {
          quantity: 2,
          product_name_snapshot: 'Taco',
          variant_name_snapshot: 'pastor',
          unit_price_cents: 2500,
          modifiers: [{ name_snapshot: 'sin cebolla' }],
          note_text: null,
        },
        {
          quantity: 1,
          product_name_snapshot: 'Coca-Cola',
          variant_name_snapshot: null,
          unit_price_cents: 3000,
          modifiers: [],
          note_text: null,
        },
      ],
      totalCents: 8000,
      paymentMethod: 'cash',
    });
    expect(html).toContain('Tacos El Güero');
    expect(html).toContain('komanda-20260420-007');
    expect(html).toContain('Juan');
    expect(html).toContain('Taco');
    expect(html).toContain('pastor');
    expect(html).toContain('sin cebolla');
    expect(html).toContain('$80.00');
    expect(html).toContain('Efectivo');
    expect(html).toContain('IVA incluido');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- renderReceipt`

- [ ] **Step 3: Implement**

File: `src/receipt/renderReceipt.ts`

```ts
import { formatMXN } from '@/domain/money';
import type { PaymentMethodT } from '@/insforge/schemas';

export interface ReceiptItem {
  quantity: number;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  unit_price_cents: number;
  modifiers: { name_snapshot: string }[];
  note_text: string | null;
}

export interface ReceiptData {
  orgName: string;
  identifier: string;
  waiterName: string;
  openedAtIso: string;
  items: ReceiptItem[];
  totalCents: number;
  paymentMethod: PaymentMethodT;
}

const PAYMENT_ES: Record<PaymentMethodT, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

export function renderReceipt(d: ReceiptData): string {
  const dt = new Date(d.openedAtIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

  const itemRows = d.items
    .map((it) => {
      const name = `${esc(it.product_name_snapshot)}${it.variant_name_snapshot ? ` (${esc(it.variant_name_snapshot)})` : ''}`;
      const mods = it.modifiers.map((m) => `<div class="mod">· ${esc(m.name_snapshot)}</div>`).join('');
      const note = it.note_text ? `<div class="note">${esc(it.note_text)}</div>` : '';
      const line = formatMXN(it.quantity * it.unit_price_cents);
      return `
        <tr>
          <td class="qty">${it.quantity}</td>
          <td class="name">${name}${mods}${note}</td>
          <td class="line">${line}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"/><style>
  @page { margin: 0; size: 80mm auto; }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #111; margin: 0; padding: 12px; width: 80mm; box-sizing: border-box; }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; margin: 6px 0; }
  hr { border: none; border-top: 1px dashed #444; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .qty { width: 22px; }
  .line { text-align: right; white-space: nowrap; }
  .mod, .note { font-size: 10px; color: #555; margin-left: 6px; }
  .totals { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 6px; }
  .iva { font-size: 10px; text-align: right; color: #555; }
  .pay { margin-top: 4px; font-size: 12px; }
  .thanks { text-align: center; margin-top: 10px; }
</style></head>
<body>
  <h1>${esc(d.orgName)}</h1>
  <div class="meta">
    <span>${esc(d.identifier)}</span>
    <span>${esc(stamp)}</span>
  </div>
  <div>Atendió: ${esc(d.waiterName)}</div>
  <hr/>
  <table>${itemRows}</table>
  <hr/>
  <div class="totals"><span>TOTAL</span><span>${formatMXN(d.totalCents)}</span></div>
  <div class="iva">IVA incluido</div>
  <div class="pay">Pago: ${PAYMENT_ES[d.paymentMethod]}</div>
  <hr/>
  <div class="thanks">¡Gracias por su visita!</div>
</body></html>`;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- renderReceipt`

- [ ] **Step 5: Commit**

```bash
git add src/receipt/renderReceipt.ts tests/receipt/renderReceipt.test.ts
git commit -m "feat(receipt): pure HTML receipt template (Spanish, IVA incluido)"
```

---

## Task 17: Share receipt via expo-print + expo-sharing

**Files:**
- Modify: `package.json` (install expo-print + expo-sharing)
- Create: `src/receipt/shareReceipt.ts`

- [ ] **Step 1: Install print + sharing**

Run: `npx expo install expo-print expo-sharing`

- [ ] **Step 2: Implement the share helper**

File: `src/receipt/shareReceipt.ts`

```ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { renderReceipt, type ReceiptData } from './renderReceipt';

/**
 * Render the receipt HTML to PDF and open the native share sheet.
 * Returns `true` if the share sheet opened, `false` if sharing isn't available.
 */
export async function shareReceipt(data: ReceiptData): Promise<boolean> {
  const html = renderReceipt(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share receipt',
  });
  return true;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/receipt/shareReceipt.ts package.json package-lock.json
git commit -m "feat(receipt): shareReceipt via expo-print + expo-sharing"
```

---

## Task 18: Close & charge screen

**Files:**
- Create: `app/(app)/komandas/[id]/close.tsx`

- [ ] **Step 1: Write the screen**

File: `app/(app)/komandas/[id]/close.tsx`

```tsx
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchKomandaById, fetchItemsForKomanda } from '@/insforge/queries/komandas';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { calculateTotal } from '@/domain/total';
import { formatMXN } from '@/domain/money';
import { displayIdentifier } from '@/domain/komandaNumber';
import { useCloseKomanda } from '@/mutations/useCloseKomanda';
import { shareReceipt } from '@/receipt/shareReceipt';
import type { PaymentMethodT } from '@/insforge/schemas';

const METHODS: { key: PaymentMethodT; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'transfer', label: 'Transfer' },
];

export default function Close() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const komanda = useQuery({ queryKey: ['komanda', id], queryFn: () => fetchKomandaById(id!), enabled: !!id });
  const items = useQuery({ queryKey: ['komanda', id, 'items'], queryFn: () => fetchItemsForKomanda(id!), enabled: !!id });
  const membership = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const close = useCloseKomanda();

  const [method, setMethod] = useState<PaymentMethodT | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!id || komanda.isLoading || items.isLoading || membership.isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!komanda.data || !membership.data) return <Text>Not found</Text>;

  const total = calculateTotal(items.data ?? []);

  async function confirmAndShare() {
    if (!method || !komanda.data || !membership.data) return;
    setSubmitting(true);
    try {
      const closed_at = new Date().toISOString();
      await close.mutateAsync({
        komanda_id: id!,
        payment_method: method,
        total_cents: total,
        closed_at,
      });
      await shareReceipt({
        orgName: 'Komanda',                         // TODO: thread org name through fetchMyMembership join
        identifier: displayIdentifier(komanda.data),
        waiterName: membership.data.display_name,
        openedAtIso: komanda.data.opened_at,
        items: (items.data ?? []).map((it) => ({
          quantity: it.quantity,
          product_name_snapshot: it.product_name_snapshot,
          variant_name_snapshot: it.variant_name_snapshot,
          unit_price_cents: it.unit_price_cents,
          modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
          note_text: it.note_text,
        })),
        totalCents: total,
        paymentMethod: method,
      });
      router.replace('/(app)/komandas');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Close &amp; charge</Text>
      <Text style={styles.id}>{displayIdentifier(komanda.data)}</Text>
      <View style={styles.itemsBlock}>
        {(items.data ?? []).map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemQty}>{it.quantity}×</Text>
            <Text style={{ flex: 1 }}>
              {it.product_name_snapshot}{it.variant_name_snapshot ? ` (${it.variant_name_snapshot})` : ''}
            </Text>
            <Text>{formatMXN(it.quantity * it.unit_price_cents)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.total}>{formatMXN(total)}</Text>
      </View>
      <Text style={styles.iva}>IVA incluido</Text>

      <Text style={styles.label}>Payment method</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => setMethod(m.key)}
            style={[styles.methodChip, method === m.key && styles.methodChipActive]}
          >
            <Text style={[styles.methodText, method === m.key && styles.methodTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={confirmAndShare}
        disabled={!method || submitting}
        style={[styles.primary, (!method || submitting) && styles.primaryDisabled]}
      >
        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Confirm &amp; share receipt</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  id: { fontSize: 14, color: '#737373' },
  itemsBlock: { backgroundColor: 'white', borderRadius: 10, padding: 12, marginTop: 8 },
  itemRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  itemQty: { width: 28, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  totalLabel: { fontSize: 18, fontWeight: '600' },
  total: { fontSize: 24, fontWeight: '800' },
  iva: { fontSize: 11, color: '#737373', textAlign: 'right' },
  label: { fontSize: 12, color: '#737373', textTransform: 'uppercase', marginTop: 16 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#e5e5e5', borderRadius: 10 },
  methodChipActive: { backgroundColor: '#111827' },
  methodText: { fontSize: 15, color: '#404040' },
  methodTextActive: { color: 'white', fontWeight: '700' },
  primary: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
```

> The `orgName: 'Komanda'` placeholder is a known shortcut; wire it properly in Task 19.

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/komandas/\[id\]/close.tsx
git commit -m "feat(app): close-and-charge screen with share receipt"
```

---

## Task 19: Thread org name through membership query

**Files:**
- Modify: `src/insforge/queries/membership.ts`
- Modify: `app/(app)/komandas/[id]/close.tsx` (use the real org name)

- [ ] **Step 1: Extend the membership query to join the organization**

Replace `src/insforge/queries/membership.ts`:

```ts
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, OrganizationRow } from '@/insforge/schemas';

const Joined = OrganizationMemberRow.extend({
  organization: OrganizationRow,
});
export type MembershipWithOrg = z.infer<typeof Joined>;

export async function fetchMyMembership(): Promise<MembershipWithOrg | null> {
  const { data, error } = await insforge
    .from('organization_members')
    .select('*, organization:organizations(*)')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return Joined.parse(data);
}
```

- [ ] **Step 2: Use the real org name in the close screen**

Modify `app/(app)/komandas/[id]/close.tsx` — replace `orgName: 'Komanda'` with `orgName: membership.data.organization.name`.

- [ ] **Step 3: Commit**

```bash
git add src/insforge/queries/membership.ts app/\(app\)/komandas/\[id\]/close.tsx
git commit -m "feat(insforge): join organization in membership query so receipt shows org name"
```

---

## Task 20: Settings screen — link to komandas

**Files:**
- Modify: `app/(app)/settings.tsx` (reach it from komandas list via a corner link; no tab bar in v1)
- Modify: `app/(app)/komandas/index.tsx` (add a small "Settings" header button)

- [ ] **Step 1: Add a Settings header button on the komandas list**

In `app/(app)/komandas/index.tsx`, above the `FlatList`, add a header row:

```tsx
import { Link } from 'expo-router';
// ...in the returned JSX, first child of <View style={styles.root}>:
<View style={styles.topBar}>
  <Text style={styles.topTitle}>Komandas</Text>
  <Link href="/(app)/settings" style={styles.settingsLink}>Settings</Link>
</View>
```

Add to styles:

```ts
topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white' },
topTitle: { fontSize: 22, fontWeight: '700' },
settingsLink: { color: '#2563eb', fontSize: 14 },
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/komandas/index.tsx
git commit -m "feat(ui): settings link in komandas top bar"
```

---

## Task 21: Re-share receipt on closed detail + failed-mutation surface

Two small but spec-required pieces:
- §5: closed komandas show **Share receipt again**.
- §9: mutations that fail past the retry budget get a red badge + retry/discard.

**Files:**
- Modify: `app/(app)/komandas/[id]/index.tsx`
- Create: `src/offline/useQueueSnapshot.ts`
- Create: `src/components/StuckMutationsBanner.tsx`
- Modify: `app/(app)/komandas/index.tsx` (mount the banner)

- [ ] **Step 1: Add reshare button on closed detail**

Modify `app/(app)/komandas/[id]/index.tsx`. Inside the `if (!closed) { ... }` block, extend to also render a closed-state CTA:

```tsx
import { shareReceipt } from '@/receipt/shareReceipt';
import { fetchMyMembership } from '@/insforge/queries/membership';
// ...inside the component:
const membership = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });

async function reshare() {
  if (!komanda.data || !membership.data || komanda.data.payment_method === null) return;
  await shareReceipt({
    orgName: membership.data.organization.name,
    identifier: displayIdentifier(komanda.data),
    waiterName: membership.data.display_name,
    openedAtIso: komanda.data.opened_at,
    items: (items.data ?? []).map((it) => ({
      quantity: it.quantity,
      product_name_snapshot: it.product_name_snapshot,
      variant_name_snapshot: it.variant_name_snapshot,
      unit_price_cents: it.unit_price_cents,
      modifiers: it.modifiers.map((m) => ({ name_snapshot: m.name_snapshot })),
      note_text: it.note_text,
    })),
    totalCents: komanda.data.total_cents ?? 0,
    paymentMethod: komanda.data.payment_method,
  });
}
```

Replace the trailing `if (!closed) { ... }` block with:

```tsx
{!closed ? (
  <>
    <Link href={`/(app)/komandas/${id}/add-item`} asChild>
      <TouchableOpacity style={styles.primary}>
        <Text style={styles.primaryText}>Add item</Text>
      </TouchableOpacity>
    </Link>
    <Link href={`/(app)/komandas/${id}/close`} asChild>
      <TouchableOpacity
        disabled={(items.data?.length ?? 0) === 0}
        style={[styles.secondary, (items.data?.length ?? 0) === 0 && styles.secondaryDisabled]}
      >
        <Text style={styles.secondaryText}>Close &amp; charge</Text>
      </TouchableOpacity>
    </Link>
  </>
) : (
  <TouchableOpacity onPress={reshare} style={styles.primary}>
    <Text style={styles.primaryText}>Share receipt again</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 2: Write `useQueueSnapshot` hook**

File: `src/offline/useQueueSnapshot.ts`

```ts
import { useEffect, useState } from 'react';
import { queueStore } from './handlers';
import { getAll, type QueuedMutation } from './queue';

/**
 * Poll the queue every 2s and return its current contents. Light on CPU and
 * good enough for a UI counter — NetInfo events already trigger the drain.
 */
export function useQueueSnapshot(): QueuedMutation[] {
  const [all, setAll] = useState<QueuedMutation[]>([]);
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      const next = await getAll(queueStore);
      if (mounted) setAll(next);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);
  return all;
}
```

- [ ] **Step 3: Write `StuckMutationsBanner` component**

File: `src/components/StuckMutationsBanner.tsx`

```tsx
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useQueueSnapshot } from '@/offline/useQueueSnapshot';
import { dequeue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';

const RETRY_BUDGET = 5;

export function StuckMutationsBanner() {
  const all = useQueueSnapshot();
  const stuck = all.filter((m) => m.attemptCount >= RETRY_BUDGET);
  if (stuck.length === 0) return null;

  function onPress() {
    Alert.alert(
      `${stuck.length} pending sync issue${stuck.length === 1 ? '' : 's'}`,
      stuck.map((m) => `· ${m.type}: ${m.lastError ?? 'unknown'}`).join('\n'),
      [
        { text: 'Leave for now', style: 'cancel' },
        {
          text: 'Discard all',
          style: 'destructive',
          onPress: async () => {
            for (const m of stuck) await dequeue(queueStore, m.id);
          },
        },
      ]
    );
  }

  return (
    <TouchableOpacity onPress={onPress} style={styles.banner}>
      <Text style={styles.text}>
        ⚠ {stuck.length} change{stuck.length === 1 ? '' : 's'} failed to sync — tap for details
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#dc2626', paddingVertical: 8, paddingHorizontal: 12 },
  text: { color: 'white', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
```

- [ ] **Step 4: Mount the banner on the komandas list**

Modify `app/(app)/komandas/index.tsx` — import and render `StuckMutationsBanner` at the top, above `topBar`:

```tsx
import { StuckMutationsBanner } from '@/components/StuckMutationsBanner';
// ...first child of <View style={styles.root}>:
<StuckMutationsBanner />
```

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/komandas/ src/offline/useQueueSnapshot.ts src/components/StuckMutationsBanner.tsx
git commit -m "feat(ui): reshare receipt on closed komandas + stuck-mutation banner"
```

---

## Task 22: Maestro E2E — sign in, create, close

**Files:**
- Create: `.maestro/sign-in-create-close.yaml`

- [ ] **Step 1: Install Maestro (documented for reference; user runs this once on their machine)**

Run: `curl -Ls "https://get.maestro.mobile.dev" | bash`

- [ ] **Step 2: Write the flow**

File: `.maestro/sign-in-create-close.yaml`

```yaml
appId: com.komandaapp
---
- launchApp
- tapOn: "Email"
- inputText: "waiter@example.com"
- tapOn: "Password"
- inputText: "correcthorsebatterystaple"
- tapOn: "Sign in"
- assertVisible: "Komandas"
- tapOn: "+ New komanda"
- tapOn: "Open komanda"
- tapOn: "Add item"
- tapOn: "Taco al pastor"
- tapOn: "+"
- tapOn:
    text: "Add to komanda"
- tapOn: "Close & charge"
- tapOn: "Cash"
- tapOn: "Confirm & share receipt"
- assertVisible: "Komandas"
```

- [ ] **Step 3: Document how to run**

Add to `README.md` (at the end of the "Test" section):

````markdown
End-to-end tests run through [Maestro](https://maestro.mobile.dev):

```bash
maestro test .maestro/sign-in-create-close.yaml
maestro test .maestro/offline-create-sync.yaml
```

Requires a seeded user `waiter@example.com` / `correcthorsebatterystaple` with membership in a test org that contains a product named `Taco al pastor`.
````

- [ ] **Step 4: Commit**

```bash
git add .maestro/sign-in-create-close.yaml README.md
git commit -m "test(e2e): Maestro flow for sign in → create komanda → close"
```

---

## Task 23: Maestro E2E — offline create + sync

**Files:**
- Create: `.maestro/offline-create-sync.yaml`

- [ ] **Step 1: Write the flow**

File: `.maestro/offline-create-sync.yaml`

```yaml
appId: com.komandaapp
---
- launchApp
- tapOn: "Email"
- inputText: "waiter@example.com"
- tapOn: "Password"
- inputText: "correcthorsebatterystaple"
- tapOn: "Sign in"
- assertVisible: "Komandas"
- runFlow:
    # Disable network via the Maestro helper. Exact step depends on platform;
    # on iOS Simulator, use Settings → Airplane Mode. Maestro 1.37+ ships
    # a `toggleAirplaneMode` command on some devices.
    commands:
      - toggleAirplaneMode
- tapOn: "+ New komanda"
- tapOn: "Open komanda"
- assertVisible:
    text: "Ticket"
- tapOn: "Add item"
- tapOn: "Taco al pastor"
- tapOn:
    text: "Add to komanda"
- runFlow:
    commands:
      - toggleAirplaneMode
- assertVisible:
    text: "komanda-"  # number assigned after sync
    timeout: 15000
```

- [ ] **Step 2: Commit**

```bash
git add .maestro/offline-create-sync.yaml
git commit -m "test(e2e): Maestro flow for offline create + on-reconnect sync"
```

---

## Task 24: Final README update + v1 sign-off checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the "Current status" section**

Replace the "Current status (Plan A — Foundation)" section in `README.md` with:

```markdown
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
```

- [ ] **Step 2: Final manual QA checklist**

Before calling v1 done, confirm on a real device + real Insforge project:

- [ ] Fresh sign-up via invite works end to end.
- [ ] Two concurrently-creating waiters get distinct komanda numbers.
- [ ] Airplane-mode create → items → close → receipt share all work; after reconnect, the komanda shows a real `komanda-YYYYMMDD-NNN` number.
- [ ] Deactivating a product on the dashboard does not alter historical komandas (snapshots preserved).
- [ ] Force-quit + relaunch restores session, last list, cached menu.
- [ ] `npm test` — all green.
- [ ] `npx tsc --noEmit` — no type errors.
- [ ] Maestro — both flows pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: v1 status notes and final QA checklist"
```
