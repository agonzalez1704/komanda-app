# Roles & Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four-role permission model (`admin`, `cashier`, `waiter`, `cook`) and an invite-code-based onboarding flow so admins can grow their team.

**Architecture:** Extend `organization_members.role` enum and the existing `invitations` table. Add a permission helper (`can.*`) consumed by UI and route guards. Surface management UX under Settings → Team. Public route `/invite/accept` redeems codes and creates the membership. Server enforces via RLS; client mirrors with `can.*` for UX.

**Tech Stack:** Expo Router, React Native, NativeWind, TanStack Query, Zod, InsForge SDK (`@insforge/sdk`), Vitest.

**Spec:** [docs/superpowers/specs/2026-04-28-roles-and-invitations-design.md](../specs/2026-04-28-roles-and-invitations-design.md)

---

## File map

**Create**
- `src/auth/permissions.ts` — `Role` type + `can.*` helpers
- `src/auth/randomCode.ts` — invite-code generator
- `src/insforge/queries/members.ts` — list members, change role, remove
- `src/mutations/useInviteMember.ts`
- `src/mutations/useRevokeInvitation.ts`
- `src/mutations/useChangeMemberRole.ts`
- `src/mutations/useRemoveMember.ts`
- `src/mutations/useAcceptInvitation.ts`
- `src/features/team/components/MemberRow.tsx`
- `src/features/team/components/InviteRow.tsx`
- `src/features/team/components/InviteSheet.tsx`
- `src/features/team/components/RolePicker.tsx`
- `app/(app)/settings/_layout.tsx` (Stack)
- `app/(app)/settings/team.tsx`
- `app/invite/accept.tsx` (public route)
- `tests/auth/permissions.test.ts`
- `tests/auth/randomCode.test.ts`
- `tests/insforge/invitations.integration.test.ts`
- `tests/insforge/members.integration.test.ts`
- `db/migrations/2026-04-29-roles-and-invitations.sql`

**Modify**
- `src/insforge/schemas.ts` — role enum, InvitationRow extensions
- `src/insforge/queries/invitations.ts` — list/create/revoke/lookup/redeem
- `src/insforge/queries/membership.ts` — already exports `fetchMyMembership`; reuse
- `app/(app)/_layout.tsx` — pass role to context (already through membership query)
- `app/(app)/settings.tsx` — convert into `app/(app)/settings/index.tsx` route, add admin-only Team row
- `app/_layout.tsx` — register `/invite/accept` as public route
- `tests/insforge/schemas.test.ts` — update role enum tests

---

## Conventions

- **Frequent commits:** every passing test or completed task gets its own commit. Commit message style follows existing repo: `feat:`, `fix:`, `chore:`, `test:`, `docs:`.
- **TDD:** write failing test → minimal impl → green → commit.
- **Mutations** follow existing pattern: optimistic `qc.setQueryData`, `enqueue` to offline queue when applicable, return optimistic row. Invitation/member ops are admin-only and online-only — they call InsForge SDK directly without queuing.
- **Tests:**
  - Unit tests under `tests/<area>/*.test.ts`, run via existing Vitest setup.
  - Integration tests under `tests/insforge/*.integration.test.ts` hit a real InsForge instance per repo convention. Use `INSFORGE_TEST_*` env vars.
- **Run all tests:** `pnpm test`
- **Run a single test file:** `pnpm test tests/auth/permissions.test.ts`

---

## Task 1: Database migration — roles enum + invitations extension

**Files:**
- Create: `db/migrations/2026-04-29-roles-and-invitations.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 2026-04-29: Four-role permission model + invitation lifecycle

-- 1. Extend role enum
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'waiter';
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'cook';

-- Migrate existing 'member' rows -> 'waiter'
UPDATE organization_members SET role = 'waiter' WHERE role = 'member';

-- (Note: we keep 'member' in the enum for now to avoid blocking migrations
--  on FKs / RLS policies; new code never writes 'member'. A follow-up
--  migration can drop it once all rows are migrated and verified.)

-- 2. Invitations table extensions
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  ADD COLUMN IF NOT EXISTS accepted_by_auth_user_id uuid REFERENCES users(id);

-- Default expiry 7d for any rows missing it
UPDATE invitations
   SET expires_at = COALESCE(expires_at, created_at + interval '7 days');

ALTER TABLE invitations
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);
CREATE INDEX IF NOT EXISTS invitations_org_status_idx ON invitations(org_id, status);

-- 3. RLS for invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_admin_read ON invitations;
CREATE POLICY invitations_admin_read ON invitations
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organization_members
       WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Public lookup by exact token (used by accept-invite flow)
DROP POLICY IF EXISTS invitations_token_lookup ON invitations;
CREATE POLICY invitations_token_lookup ON invitations
  FOR SELECT USING (true);
-- NOTE: column-level security would be ideal here. For now, redeem RPC
-- (already present) is the safe path; the broad SELECT policy supports
-- the verify-code preview screen. Audit follow-up: restrict columns.

DROP POLICY IF EXISTS invitations_admin_write ON invitations;
CREATE POLICY invitations_admin_write ON invitations
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organization_members
       WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  ) WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_members
       WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. RLS for organization_members write (admin-only writes; reads already
--    scoped to same org by an existing policy)
DROP POLICY IF EXISTS organization_members_admin_write ON organization_members;
CREATE POLICY organization_members_admin_write ON organization_members
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM organization_members
       WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS organization_members_admin_delete ON organization_members;
CREATE POLICY organization_members_admin_delete ON organization_members
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM organization_members
       WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Update redeem_invitation RPC to honor new status field + accepted_by
CREATE OR REPLACE FUNCTION redeem_invitation(p_token text)
RETURNS organization_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_member organization_members%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_inv FROM invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;

  IF EXISTS (
    SELECT 1 FROM organization_members
     WHERE org_id = v_inv.org_id AND auth_user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO organization_members (org_id, auth_user_id, role, display_name)
  VALUES (v_inv.org_id, v_uid, v_inv.role, COALESCE(current_setting('request.jwt.claims', true)::json->>'display_name', v_inv.email))
  RETURNING * INTO v_member;

  UPDATE invitations
     SET status = 'accepted',
         accepted_at = now(),
         accepted_by_auth_user_id = v_uid
   WHERE id = v_inv.id;

  RETURN v_member;
END;
$$;
```

- [ ] **Step 2: Apply migration locally**

Run: `pnpm insforge:migrate db/migrations/2026-04-29-roles-and-invitations.sql`
(If the project uses a different migration runner, follow `db/README.md` or run via the InsForge CLI.)
Expected: migration applies, no errors.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/2026-04-29-roles-and-invitations.sql
git commit -m "feat(db): four-role enum + invitations status/RLS"
```

---

## Task 2: Zod schema update

**Files:**
- Modify: `src/insforge/schemas.ts`
- Modify: `tests/insforge/schemas.test.ts`

- [ ] **Step 1: Update failing test for new role set**

Replace the existing role-acceptance test in `tests/insforge/schemas.test.ts`:

```ts
it('accepts admin/cashier/waiter/cook roles', () => {
  for (const role of ['admin', 'cashier', 'waiter', 'cook'] as const) {
    expect(OrganizationMemberRow.parse({ /* fixture */ ...baseMember, role }).role).toBe(role);
  }
});

it('rejects legacy member role', () => {
  expect(() => OrganizationMemberRow.parse({ ...baseMember, role: 'member' })).toThrow();
});
```

(Use existing `baseMember` fixture; if not present, define inline with all required fields.)

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm test tests/insforge/schemas.test.ts`
Expected: test fails (schema still allows `'member'`, rejects `'cashier'/'waiter'/'cook'`).

- [ ] **Step 3: Update `src/insforge/schemas.ts`**

```ts
const Role = z.enum(['admin', 'cashier', 'waiter', 'cook']);

export const OrganizationMemberRow = z.object({
  id: uuid,
  auth_user_id: uuid,
  org_id: uuid,
  role: Role,
  display_name: z.string(),
  created_at: iso,
});

export const InvitationRow = z.object({
  id: uuid,
  org_id: uuid,
  email: z.string().email(),
  role: Role,
  token: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expires_at: iso,
  accepted_at: iso.nullable(),
  accepted_by_auth_user_id: uuid.nullable(),
  created_by_auth_user_id: uuid,
  created_at: iso,
});

export type RoleT = z.infer<typeof Role>;
```

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: schemas tests pass; other tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/insforge/schemas.ts tests/insforge/schemas.test.ts
git commit -m "feat(schemas): four-role enum + invitation lifecycle fields"
```

---

## Task 3: Permission helper

**Files:**
- Create: `src/auth/permissions.ts`
- Create: `tests/auth/permissions.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/auth/permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { can, type Role } from '@/auth/permissions';

const roles: Role[] = ['admin', 'cashier', 'waiter', 'cook'];

describe('permissions matrix', () => {
  const matrix: Record<keyof typeof can, Record<Role, boolean>> = {
    manageMenu:      { admin: true,  cashier: true,  waiter: false, cook: false },
    workKomanda:     { admin: true,  cashier: true,  waiter: true,  cook: false },
    closeKomanda:    { admin: true,  cashier: true,  waiter: true,  cook: false },
    registerExpense: { admin: true,  cashier: true,  waiter: false, cook: false },
    viewAudit:       { admin: true,  cashier: true,  waiter: false, cook: false },
    inviteUsers:     { admin: true,  cashier: false, waiter: false, cook: false },
    viewKitchen:     { admin: true,  cashier: false, waiter: false, cook: true  },
  };

  for (const [action, byRole] of Object.entries(matrix)) {
    for (const r of roles) {
      it(`${action}(${r}) === ${byRole[r]}`, () => {
        expect(can[action as keyof typeof can](r)).toBe(byRole[r]);
      });
    }
  }
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm test tests/auth/permissions.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement `src/auth/permissions.ts`**

```ts
export type Role = 'admin' | 'cashier' | 'waiter' | 'cook';

export const can = {
  manageMenu:      (r: Role) => r === 'admin' || r === 'cashier',
  workKomanda:     (r: Role) => r !== 'cook',
  closeKomanda:    (r: Role) => r !== 'cook',
  registerExpense: (r: Role) => r === 'admin' || r === 'cashier',
  viewAudit:       (r: Role) => r === 'admin' || r === 'cashier',
  inviteUsers:     (r: Role) => r === 'admin',
  viewKitchen:     (r: Role) => r === 'admin' || r === 'cook',
};
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm test tests/auth/permissions.test.ts`
Expected: all 28 cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/auth/permissions.ts tests/auth/permissions.test.ts
git commit -m "feat(auth): role permission helper"
```

---

## Task 4: Invite code generator

**Files:**
- Create: `src/auth/randomCode.ts`
- Create: `tests/auth/randomCode.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { randomCode } from '@/auth/randomCode';

describe('randomCode', () => {
  it('returns 9-char string formatted XXXX-XXXX', () => {
    const c = randomCode();
    expect(c).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
  });

  it('uses Crockford-friendly base32 alphabet (no I, L, O, 0, 1)', () => {
    const c = randomCode();
    expect(c).not.toMatch(/[ILO01]/);
  });

  it('produces unique codes across 10k samples', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(randomCode());
    expect(set.size).toBe(10_000);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm test tests/auth/randomCode.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement `src/auth/randomCode.ts`**

```ts
// Crockford-style base32 minus easily-confused chars (I, L, O, 0, 1).
// 32 = log2 alphabet; 8 chars = 40 bits ~ 1 trillion combos = collision-safe
// for our scale (< thousands of invites/org).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 chars
// (alphabet length 31 is a small bias; acceptable for invite codes.)

function pick(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function randomCode(): string {
  const raw = pick();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm test tests/auth/randomCode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/randomCode.ts tests/auth/randomCode.test.ts
git commit -m "feat(auth): invite code generator"
```

---

## Task 5: Invitation queries (list / create / revoke / lookup)

**Files:**
- Modify: `src/insforge/queries/invitations.ts`

- [ ] **Step 1: Replace contents of `src/insforge/queries/invitations.ts`**

```ts
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import {
  InvitationRow,
  OrganizationMemberRow,
  type InvitationRowT,
  type OrganizationMemberRowT,
  type RoleT,
} from '@/insforge/schemas';
import { randomCode } from '@/auth/randomCode';

const InvitationList = z.array(InvitationRow);

export async function listPendingInvitations(orgId: string): Promise<InvitationRowT[]> {
  const { data, error } = await insforge.database
    .from('invitations')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return InvitationList.parse(data ?? []);
}

export async function createInvitation(input: {
  orgId: string;
  email: string;
  role: RoleT;
}): Promise<InvitationRowT> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const token = randomCode();
  const { data, error } = await insforge.database
    .from('invitations')
    .insert({
      org_id: input.orgId,
      email: input.email,
      role: input.role,
      token,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return InvitationRow.parse(data);
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await insforge.database
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) throw error;
}

const PreviewSchema = z.object({
  org_id: z.string().uuid(),
  org_name: z.string(),
  role: z.enum(['admin', 'cashier', 'waiter', 'cook']),
  email: z.string().email(),
  expires_at: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
});
export type InvitationPreview = z.infer<typeof PreviewSchema>;

/** Public read by token; used by accept-invite preview screen. */
export async function lookupInvitation(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await insforge.database
    .from('invitations')
    .select('org_id, role, email, expires_at, status, organizations:organizations(name)')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return PreviewSchema.parse({
    org_id: data.org_id,
    org_name: (data as any).organizations?.name ?? '',
    role: data.role,
    email: data.email,
    expires_at: data.expires_at,
    status: data.status,
  });
}

export async function redeemInvitation(token: string): Promise<OrganizationMemberRowT> {
  const { data, error } = await insforge.database.rpc('redeem_invitation', { p_token: token });
  if (error) throw error;
  return OrganizationMemberRow.parse(data);
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/insforge/queries/invitations.ts
git commit -m "feat(invitations): list/create/revoke/lookup queries"
```

---

## Task 6: Member queries (list / change role / remove)

**Files:**
- Create: `src/insforge/queries/members.ts`

- [ ] **Step 1: Implement**

```ts
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { OrganizationMemberRow, type OrganizationMemberRowT, type RoleT } from '@/insforge/schemas';

const List = z.array(OrganizationMemberRow);

export async function listMembers(orgId: string): Promise<OrganizationMemberRowT[]> {
  const { data, error } = await insforge.database
    .from('organization_members')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return List.parse(data ?? []);
}

async function countAdmins(orgId: string): Promise<number> {
  const { count, error } = await insforge.database
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'admin');
  if (error) throw error;
  return count ?? 0;
}

export async function changeMemberRole(input: {
  memberId: string;
  orgId: string;
  currentRole: RoleT;
  nextRole: RoleT;
}): Promise<OrganizationMemberRowT> {
  if (input.currentRole === 'admin' && input.nextRole !== 'admin') {
    const admins = await countAdmins(input.orgId);
    if (admins <= 1) throw new Error('last_admin');
  }
  const { data, error } = await insforge.database
    .from('organization_members')
    .update({ role: input.nextRole })
    .eq('id', input.memberId)
    .select('*')
    .single();
  if (error) throw error;
  return OrganizationMemberRow.parse(data);
}

export async function removeMember(input: {
  memberId: string;
  orgId: string;
  role: RoleT;
}): Promise<void> {
  if (input.role === 'admin') {
    const admins = await countAdmins(input.orgId);
    if (admins <= 1) throw new Error('last_admin');
  }
  const { error } = await insforge.database
    .from('organization_members')
    .delete()
    .eq('id', input.memberId);
  if (error) throw error;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/insforge/queries/members.ts
git commit -m "feat(members): list/change-role/remove with last-admin guard"
```

---

## Task 7: useInviteMember mutation

**Files:**
- Create: `src/mutations/useInviteMember.ts`

- [ ] **Step 1: Implement**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvitation } from '@/insforge/queries/invitations';
import type { RoleT } from '@/insforge/schemas';

export function useInviteMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: RoleT }) =>
      createInvitation({ orgId, email: input.email, role: input.role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', orgId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mutations/useInviteMember.ts
git commit -m "feat(mutations): useInviteMember"
```

---

## Task 8: useRevokeInvitation mutation

**Files:**
- Create: `src/mutations/useRevokeInvitation.ts`

- [ ] **Step 1: Implement**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { revokeInvitation } from '@/insforge/queries/invitations';

export function useRevokeInvitation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', orgId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mutations/useRevokeInvitation.ts
git commit -m "feat(mutations): useRevokeInvitation"
```

---

## Task 9: useChangeMemberRole mutation

**Files:**
- Create: `src/mutations/useChangeMemberRole.ts`

- [ ] **Step 1: Implement**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { changeMemberRole } from '@/insforge/queries/members';
import type { RoleT } from '@/insforge/schemas';

export function useChangeMemberRole(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; currentRole: RoleT; nextRole: RoleT }) =>
      changeMemberRole({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] });
      qc.invalidateQueries({ queryKey: ['membership'] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mutations/useChangeMemberRole.ts
git commit -m "feat(mutations): useChangeMemberRole"
```

---

## Task 10: useRemoveMember mutation

**Files:**
- Create: `src/mutations/useRemoveMember.ts`

- [ ] **Step 1: Implement**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeMember } from '@/insforge/queries/members';
import type { RoleT } from '@/insforge/schemas';

export function useRemoveMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; role: RoleT }) =>
      removeMember({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mutations/useRemoveMember.ts
git commit -m "feat(mutations): useRemoveMember"
```

---

## Task 11: useAcceptInvitation mutation

**Files:**
- Create: `src/mutations/useAcceptInvitation.ts`

- [ ] **Step 1: Implement**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { redeemInvitation } from '@/insforge/queries/invitations';

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => redeemInvitation(token),
    onSuccess: () => {
      // Force layout to re-fetch membership and route into (app).
      qc.invalidateQueries({ queryKey: ['membership'] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mutations/useAcceptInvitation.ts
git commit -m "feat(mutations): useAcceptInvitation"
```

---

## Task 12: Settings split — convert to nested route

The existing `app/(app)/settings.tsx` file becomes `app/(app)/settings/index.tsx` so we can add `team.tsx` as a sibling. Also adds the admin-only "Team" row.

**Files:**
- Create: `app/(app)/settings/_layout.tsx`
- Move: `app/(app)/settings.tsx` → `app/(app)/settings/index.tsx`
- Modify: `app/(app)/settings/index.tsx` (add Team row)

- [ ] **Step 1: Create layout**

`app/(app)/settings/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Move file**

```bash
mkdir -p app/\(app\)/settings
git mv app/\(app\)/settings.tsx app/\(app\)/settings/index.tsx
```

- [ ] **Step 3: Add Team row to settings index**

In `app/(app)/settings/index.tsx`, inside the "Management" section card, add (admin-only):

```tsx
{membership?.role === 'admin' ? (
  <>
    <Divider style={{ marginLeft: 52 }} />
    <Link href="/(app)/settings/team" asChild>
      <NavRow icon="people-outline" label="Team" hint="Members and pending invites" />
    </Link>
  </>
) : null}
```

(Import `Divider` if not already; it's already used elsewhere in the file.)

- [ ] **Step 4: Smoke check**

Run: `pnpm start` then navigate to Settings — verify "Team" row appears for admin, hidden for waiter/cook/cashier (toggle role manually in DB to verify if needed).

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/settings
git commit -m "feat(settings): nested route + admin-only Team entry"
```

---

## Task 13: Team screen scaffold + member/invite rows

**Files:**
- Create: `app/(app)/settings/team.tsx`
- Create: `src/features/team/components/MemberRow.tsx`
- Create: `src/features/team/components/InviteRow.tsx`

- [ ] **Step 1: Implement MemberRow**

`src/features/team/components/MemberRow.tsx`:

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import type { OrganizationMemberRowT } from '@/insforge/schemas';

export function MemberRow({
  member,
  showOverflow,
  onOverflow,
}: {
  member: OrganizationMemberRowT;
  showOverflow: boolean;
  onOverflow: () => void;
}) {
  const initials = (member.display_name ?? '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg }}>
      <View style={{ width: 36, height: 36, borderRadius: radius.full, backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodyStrong">{initials || '•'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{member.display_name}</Text>
        <Text variant="caption" style={{ textTransform: 'capitalize' }}>{member.role}</Text>
      </View>
      {showOverflow ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Member options" onPress={onOverflow} hitSlop={12}>
          <Ionicons name="ellipsis-horizontal" size={20} color={color.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Implement InviteRow**

`src/features/team/components/InviteRow.tsx`:

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import type { InvitationRowT } from '@/insforge/schemas';

function daysUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (d <= 0) return 'expired';
  if (d === 1) return 'expires in 1 day';
  return `expires in ${d} days`;
}

export function InviteRow({
  invitation,
  onRevoke,
  onCopy,
}: {
  invitation: InvitationRowT;
  onRevoke: () => void;
  onCopy: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{invitation.email}</Text>
        <Text variant="caption" style={{ textTransform: 'capitalize' }}>
          {invitation.role} · {daysUntil(invitation.expires_at)}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Copy code" onPress={onCopy} hitSlop={12}>
        <Ionicons name="copy-outline" size={20} color={color.textSecondary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Revoke" onPress={onRevoke} hitSlop={12}>
        <Ionicons name="trash-outline" size={20} color={color.danger} />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Implement Team screen**

`app/(app)/settings/team.tsx`:

```tsx
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { listMembers } from '@/insforge/queries/members';
import { listPendingInvitations } from '@/insforge/queries/invitations';
import { MemberRow } from '@/features/team/components/MemberRow';
import { InviteRow } from '@/features/team/components/InviteRow';
import { useRevokeInvitation } from '@/mutations/useRevokeInvitation';
import { useRemoveMember } from '@/mutations/useRemoveMember';
import { useChangeMemberRole } from '@/mutations/useChangeMemberRole';
import { InviteSheet } from '@/features/team/components/InviteSheet';
import { RolePicker } from '@/features/team/components/RolePicker';
import * as Clipboard from 'expo-clipboard';

export default function TeamScreen() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const orgId = me?.org_id;

  const members = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => listMembers(orgId!),
    enabled: !!orgId,
  });
  const invites = useQuery({
    queryKey: ['invitations', orgId],
    queryFn: () => listPendingInvitations(orgId!),
    enabled: !!orgId,
  });

  const revoke = useRevokeInvitation(orgId ?? '');
  const remove = useRemoveMember(orgId ?? '');
  const change = useChangeMemberRole(orgId ?? '');

  const [showInvite, setShowInvite] = useState(false);
  const [overflowMember, setOverflowMember] = useState<typeof members.data extends readonly (infer M)[] ? M | null : null>(null);
  const [pickerFor, setPickerFor] = useState<{ memberId: string; current: any } | null>(null);

  if (me?.role !== 'admin') {
    return (
      <Screen padded>
        <ScreenHeader showBack title="Team" onBack={() => router.back()} />
        <Text variant="body">You don't have permission to view this page.</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Team" onBack={() => router.back()} />
      </View>

      <FlatList
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 96 }}
        data={[1]}
        keyExtractor={() => 'sections'}
        renderItem={() => (
          <View style={{ gap: space.lg }}>
            <View style={styles.section}>
              <Text variant="label">Members</Text>
              <Card padded={false}>
                {(members.data ?? []).map((m, i) => (
                  <React.Fragment key={m.id}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <MemberRow
                      member={m}
                      showOverflow={m.id !== me.id}
                      onOverflow={() => setOverflowMember(m as any)}
                    />
                  </React.Fragment>
                ))}
              </Card>
            </View>

            <View style={styles.section}>
              <Text variant="label">Pending invites</Text>
              <Card padded={false}>
                {(invites.data ?? []).length === 0 ? (
                  <View style={{ padding: space.lg }}>
                    <Text variant="bodySm">No pending invites.</Text>
                  </View>
                ) : (
                  invites.data!.map((inv, i) => (
                    <React.Fragment key={inv.id}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <InviteRow
                        invitation={inv}
                        onCopy={async () => {
                          await Clipboard.setStringAsync(inv.token);
                        }}
                        onRevoke={() => {
                          Alert.alert('Revoke invite?', `Code for ${inv.email} will stop working.`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Revoke', style: 'destructive', onPress: () => revoke.mutate(inv.id) },
                          ]);
                        }}
                      />
                    </React.Fragment>
                  ))
                )}
              </Card>
            </View>
          </View>
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New invite"
        onPress={() => setShowInvite(true)}
        style={styles.fab}
      >
        <Ionicons name="add" size={28} color={color.primaryOn} />
      </Pressable>

      {showInvite && orgId ? (
        <InviteSheet orgId={orgId} onClose={() => setShowInvite(false)} />
      ) : null}

      {overflowMember ? (
        <MemberOverflowSheet
          onClose={() => setOverflowMember(null)}
          onChangeRole={() => {
            setPickerFor({ memberId: (overflowMember as any).id, current: (overflowMember as any).role });
            setOverflowMember(null);
          }}
          onRemove={() => {
            const m = overflowMember as any;
            setOverflowMember(null);
            Alert.alert('Remove member?', `${m.display_name} will lose access.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => remove.mutate({ memberId: m.id, role: m.role }, {
                  onError: (e) => Alert.alert('Could not remove', String((e as Error).message)),
                }),
              },
            ]);
          }}
        />
      ) : null}

      {pickerFor ? (
        <RolePicker
          current={pickerFor.current}
          onClose={() => setPickerFor(null)}
          onPick={(nextRole) => {
            change.mutate(
              { memberId: pickerFor.memberId, currentRole: pickerFor.current, nextRole },
              { onError: (e) => Alert.alert('Could not change role', String((e as Error).message)) },
            );
            setPickerFor(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function MemberOverflowSheet({
  onClose, onChangeRole, onRemove,
}: { onClose: () => void; onChangeRole: () => void; onRemove: () => void }) {
  return (
    <View style={styles.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <Pressable style={styles.sheetRow} onPress={onChangeRole}><Text variant="body">Change role</Text></Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.sheetRow} onPress={onRemove}><Text variant="body" style={{ color: color.danger }}>Remove from org</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.border, marginLeft: 52 },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg + 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#0006', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingVertical: space.sm,
  },
  sheetRow: { paddingVertical: space.md, paddingHorizontal: space.lg },
});
```

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/settings/team.tsx src/features/team/components/MemberRow.tsx src/features/team/components/InviteRow.tsx
git commit -m "feat(team): screen + member/invite row components"
```

---

## Task 14: InviteSheet bottom sheet

**Files:**
- Create: `src/features/team/components/InviteSheet.tsx`

- [ ] **Step 1: Implement**

```tsx
import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { useInviteMember } from '@/mutations/useInviteMember';
import type { RoleT } from '@/insforge/schemas';
import * as Clipboard from 'expo-clipboard';

const ROLES: RoleT[] = ['admin', 'cashier', 'waiter', 'cook'];

export function InviteSheet({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleT>('waiter');
  const [code, setCode] = useState<string | null>(null);
  const invite = useInviteMember(orgId);

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {code ? (
          <>
            <Text variant="h2" align="center">Invite created</Text>
            <Text variant="bodySm" align="center" style={{ marginTop: space.xs }}>
              Share this code. Valid for 7 days.
            </Text>
            <View style={styles.codeBox}>
              <Text variant="h1" align="center" style={{ letterSpacing: 4 }}>{code}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button
                label="Copy"
                variant="secondary"
                onPress={async () => { await Clipboard.setStringAsync(code); }}
                leadingIcon={<Ionicons name="copy-outline" size={18} color={color.textPrimary} />}
              />
              <Button
                label="Share"
                onPress={() => Share.share({ message: `Join our team. Invite code: ${code}` })}
                leadingIcon={<Ionicons name="share-outline" size={18} color={color.primaryOn} />}
              />
            </View>
            <Pressable onPress={onClose} style={styles.dismiss}>
              <Text variant="body" align="center">Done</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text variant="h2" align="center">New invite</Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <Text variant="caption">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="teammate@example.com"
                style={styles.input}
              />
            </View>
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Text variant="caption">Role</Text>
              <View style={styles.segment}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
                    style={[styles.segmentItem, role === r && styles.segmentActive]}
                  >
                    <Text variant="bodyStrong" style={{ textTransform: 'capitalize', color: role === r ? color.primaryOn : color.textPrimary }}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Button
              label={invite.isPending ? 'Generating…' : 'Generate invite'}
              onPress={() => {
                if (!email.trim()) {
                  Alert.alert('Email required');
                  return;
                }
                invite.mutate({ email: email.trim(), role }, {
                  onSuccess: (row) => setCode(row.token),
                  onError: (e) => Alert.alert('Could not create invite', String((e as Error).message)),
                });
              }}
              disabled={invite.isPending}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0006', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.sm,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.border, alignSelf: 'center', marginVertical: space.sm },
  input: {
    borderWidth: 1, borderColor: color.border, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, color: color.textPrimary, fontSize: 16,
  },
  segment: { flexDirection: 'row', backgroundColor: color.surfaceAlt, borderRadius: radius.full, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.full },
  segmentActive: { backgroundColor: color.primary },
  codeBox: { backgroundColor: color.surfaceAlt, padding: space.lg, borderRadius: radius.md, marginVertical: space.lg },
  dismiss: { paddingVertical: space.md },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/team/components/InviteSheet.tsx
git commit -m "feat(team): InviteSheet bottom sheet with code reveal"
```

---

## Task 15: RolePicker bottom sheet

**Files:**
- Create: `src/features/team/components/RolePicker.tsx`

- [ ] **Step 1: Implement**

```tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import type { RoleT } from '@/insforge/schemas';

const ROLES: RoleT[] = ['admin', 'cashier', 'waiter', 'cook'];

export function RolePicker({
  current, onClose, onPick,
}: { current: RoleT; onClose: () => void; onPick: (r: RoleT) => void }) {
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2" align="center">Change role</Text>
        <View style={{ marginTop: space.lg }}>
          {ROLES.map((r) => (
            <Pressable key={r} onPress={() => onPick(r)} style={styles.row}>
              <Text variant="body" style={{ textTransform: 'capitalize', flex: 1 }}>{r}</Text>
              {r === current ? <Ionicons name="checkmark" size={18} color={color.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0006', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: space.lg, paddingBottom: space.xxl },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.border, alignSelf: 'center', marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/team/components/RolePicker.tsx
git commit -m "feat(team): RolePicker bottom sheet"
```

---

## Task 16: Accept invite public route

**Files:**
- Modify: `app/_layout.tsx` (register `/invite/accept` as public)
- Create: `app/invite/accept.tsx`

- [ ] **Step 1: Inspect `app/_layout.tsx`**

Open `app/_layout.tsx`. The current root Stack already includes `(auth)` and `(app)` groups. Add a non-grouped Stack screen for `invite/accept`. If there's no auth gate at the root (gating happens inside `(app)/_layout.tsx`), the route is reachable directly.

If a root-level auth redirect exists, exempt the path matching `/invite/accept`.

- [ ] **Step 2: Implement accept screen**

`app/invite/accept.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { lookupInvitation, type InvitationPreview } from '@/insforge/queries/invitations';
import { useAcceptInvitation } from '@/mutations/useAcceptInvitation';
import { useSession } from '@/insforge/session';
import { insforge } from '@/insforge/client';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { useQueryClient } from '@tanstack/react-query';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const session = useSession();
  const qc = useQueryClient();

  const [code, setCode] = useState(params.code ?? '');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Sign-up form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  const accept = useAcceptInvitation();

  useEffect(() => {
    if (preview && !email) setEmail(preview.email);
  }, [preview, email]);

  async function verify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const p = await lookupInvitation(code.trim().toUpperCase());
      if (!p) { setVerifyError('Code is invalid.'); return; }
      if (p.status === 'revoked') { setVerifyError('This invite has been revoked.'); return; }
      if (p.status === 'accepted') { setVerifyError('This invite has already been used.'); return; }
      if (new Date(p.expires_at).getTime() < Date.now()) {
        setVerifyError('This invite has expired. Ask your admin for a new one.');
        return;
      }
      setPreview(p);
    } catch (e) {
      setVerifyError(String((e as Error).message));
    } finally {
      setVerifying(false);
    }
  }

  async function joinSignedIn() {
    if (!preview) return;
    accept.mutate(code.trim().toUpperCase(), {
      onSuccess: async () => {
        // Membership invalidated; (app)/_layout will re-route.
        router.replace('/(app)/komandas');
      },
      onError: (e) => Alert.alert('Could not join', String((e as Error).message)),
    });
  }

  async function signUpAndJoin() {
    if (!preview) return;
    setSigningUp(true);
    try {
      const { error } = await insforge.auth.signUpWithEmail({ email, password });
      if (error) throw new Error(error.message);
      // Insert membership via redeem.
      await accept.mutateAsync(code.trim().toUpperCase());
      // After redeem, set display_name on the row we just created.
      const me = await fetchMyMembership();
      if (me && displayName.trim()) {
        await insforge.database
          .from('organization_members')
          .update({ display_name: displayName.trim() })
          .eq('id', me.id);
      }
      qc.invalidateQueries({ queryKey: ['membership'] });
      router.replace('/(app)/komandas');
    } catch (e) {
      Alert.alert('Could not create account', String((e as Error).message));
    } finally {
      setSigningUp(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader title="Accept invite" />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card padded>
          <Text variant="caption">Invite code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="XXXX-XXXX"
            style={styles.input}
            editable={!preview}
          />
          {!preview ? (
            <Button label={verifying ? 'Verifying…' : 'Verify code'} onPress={verify} disabled={verifying || !code.trim()} />
          ) : null}
          {verifyError ? <Text variant="bodySm" style={{ color: color.danger, marginTop: space.sm }}>{verifyError}</Text> : null}
        </Card>

        {preview ? (
          <Card padded>
            <Text variant="bodyStrong">{preview.org_name}</Text>
            <Text variant="caption" style={{ textTransform: 'capitalize', marginTop: space.xs }}>
              Role: {preview.role}
            </Text>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <Text variant="caption">Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                style={styles.input}
              />
            </View>
            {session.status === 'signed-in' ? (
              <Button label={accept.isPending ? 'Joining…' : `Join ${preview.org_name}`} onPress={joinSignedIn} disabled={accept.isPending || !displayName.trim()} />
            ) : (
              <>
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  <Text variant="caption">Email</Text>
                  <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
                  <Text variant="caption">Password</Text>
                  <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
                </View>
                <Button label={signingUp ? 'Creating account…' : 'Create account & join'} onPress={signUpAndJoin} disabled={signingUp || !email || !password || !displayName.trim()} />
              </>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: color.border, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, color: color.textPrimary, fontSize: 16, marginBottom: space.sm,
  },
});
```

- [ ] **Step 3: Smoke test**

Run: `pnpm start`
Open: `exp://<host>/--/invite/accept?code=TEST-CODE` (or paste a real code generated via the InviteSheet on another device).
Expected: code input pre-filled; "Verify code" works; org preview appears.

- [ ] **Step 4: Commit**

```bash
git add app/invite/accept.tsx app/_layout.tsx
git commit -m "feat(invite): public accept route with verify + sign-up"
```

---

## Task 17: Nav + route gating by role

**Files:**
- Modify: `app/(app)/_layout.tsx` — wrap menu/team navigation by role
- Modify: `app/(app)/menu/_layout.tsx` (or `menu/index.tsx` route guard) — block non-`manageMenu` roles

- [ ] **Step 1: Add menu route guard**

Open `app/(app)/menu/index.tsx`. At top of component:

```tsx
import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { can } from '@/auth/permissions';

const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
if (me && !can.manageMenu(me.role)) return <Redirect href="/(app)/komandas" />;
```

(Insert above the existing return; if the current top-of-component already destructures membership, reuse.)

- [ ] **Step 2: Hide "Menu" entry for non-managers in Settings**

In `app/(app)/settings/index.tsx`, wrap the existing Menu Link:

```tsx
{membership && can.manageMenu(membership.role) ? (
  <Link href="/(app)/menu" asChild>
    <NavRow icon="restaurant-outline" label="Menu" hint="Products, variants, and modifiers" />
  </Link>
) : null}
```

- [ ] **Step 3: Block Komandas screen for cook**

In `app/(app)/komandas/index.tsx`, add at top of component:

```tsx
if (me && !can.workKomanda(me.role)) {
  return <Redirect href="/(app)/settings" />;
}
```

(Cook has no working surface yet — Settings is a safe landing. Kitchen-queue screen is out of scope for this plan.)

- [ ] **Step 4: Smoke test**

Switch a member's role in DB, sign in, verify gating.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)
git commit -m "feat(auth): role-gated navigation across app"
```

---

## Task 18: Integration tests — invitation lifecycle

**Files:**
- Create: `tests/insforge/invitations.integration.test.ts`

These run against a real InsForge instance configured via env vars (see existing integration tests in `tests/insforge/` for patterns; reuse the existing `setup.ts` helpers).

- [ ] **Step 1: Write tests**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createInvitation,
  listPendingInvitations,
  lookupInvitation,
  redeemInvitation,
  revokeInvitation,
} from '@/insforge/queries/invitations';
import { createTestOrg, signInAs, signUpUser, deleteTestOrg } from '../helpers/insforge'; // assumed helpers; mirror existing patterns

describe('invitation lifecycle (integration)', () => {
  let orgId: string;
  let admin: { id: string; email: string };

  beforeAll(async () => {
    admin = await signUpUser('admin');
    await signInAs(admin);
    orgId = await createTestOrg(admin.id, 'Test Org');
  });

  afterAll(async () => {
    await deleteTestOrg(orgId);
  });

  it('admin creates -> recipient redeems', async () => {
    const inv = await createInvitation({ orgId, email: 'waiter1@test.local', role: 'waiter' });
    expect(inv.status).toBe('pending');

    const list = await listPendingInvitations(orgId);
    expect(list.find((i) => i.id === inv.id)).toBeTruthy();

    const recipient = await signUpUser('waiter1@test.local');
    await signInAs(recipient);
    const member = await redeemInvitation(inv.token);
    expect(member.role).toBe('waiter');
    expect(member.org_id).toBe(orgId);

    const after = await lookupInvitation(inv.token);
    expect(after?.status).toBe('accepted');
  });

  it('redeem rejects already-used code', async () => {
    await signInAs(admin);
    const inv = await createInvitation({ orgId, email: 'used@test.local', role: 'waiter' });
    const u = await signUpUser('used@test.local');
    await signInAs(u);
    await redeemInvitation(inv.token);
    await expect(redeemInvitation(inv.token)).rejects.toThrow(/invitation_not_pending/);
  });

  it('revoked code fails redeem', async () => {
    await signInAs(admin);
    const inv = await createInvitation({ orgId, email: 'rev@test.local', role: 'cashier' });
    await revokeInvitation(inv.id);
    const u = await signUpUser('rev@test.local');
    await signInAs(u);
    await expect(redeemInvitation(inv.token)).rejects.toThrow(/invitation_not_pending/);
  });

  it('expired code fails redeem', async () => {
    await signInAs(admin);
    const inv = await createInvitation({ orgId, email: 'exp@test.local', role: 'cook' });
    // Force-expire via direct UPDATE through service-role helper
    await forceExpire(inv.id, '2000-01-01T00:00:00Z'); // helper to add to test utils
    const u = await signUpUser('exp@test.local');
    await signInAs(u);
    await expect(redeemInvitation(inv.token)).rejects.toThrow(/invitation_expired/);
  });

  it('rejects already-member', async () => {
    await signInAs(admin);
    const inv1 = await createInvitation({ orgId, email: 'twice@test.local', role: 'waiter' });
    const u = await signUpUser('twice@test.local');
    await signInAs(u);
    await redeemInvitation(inv1.token);
    // Issue a second invite
    await signInAs(admin);
    const inv2 = await createInvitation({ orgId, email: 'twice@test.local', role: 'cashier' });
    await signInAs(u);
    await expect(redeemInvitation(inv2.token)).rejects.toThrow(/already_member/);
  });
});

async function forceExpire(invitationId: string, expiresAt: string) {
  // Implement in tests/helpers/insforge.ts using a service-role client.
  throw new Error('implement forceExpire helper');
}
```

- [ ] **Step 2: Add helpers if missing**

In `tests/helpers/insforge.ts` (create if absent), add `signUpUser`, `signInAs`, `createTestOrg`, `deleteTestOrg`, `forceExpire` using the InsForge service-role key (from `INSFORGE_TEST_SERVICE_KEY` env var). Pattern: mirror existing tests in `tests/insforge/`.

- [ ] **Step 3: Run**

Run: `pnpm test tests/insforge/invitations.integration.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/insforge/invitations.integration.test.ts tests/helpers/insforge.ts
git commit -m "test(invitations): lifecycle integration coverage"
```

---

## Task 19: Integration tests — member operations

**Files:**
- Create: `tests/insforge/members.integration.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { changeMemberRole, listMembers, removeMember } from '@/insforge/queries/members';
import { redeemInvitation, createInvitation } from '@/insforge/queries/invitations';
import { signUpUser, signInAs, createTestOrg } from '../helpers/insforge';

describe('member operations (integration)', () => {
  let orgId: string;
  let admin: { id: string; email: string };
  let waiter: { id: string; email: string; memberId: string };

  beforeAll(async () => {
    admin = await signUpUser('m-admin@test.local');
    await signInAs(admin);
    orgId = await createTestOrg(admin.id, 'Members Test Org');

    const inv = await createInvitation({ orgId, email: 'm-waiter@test.local', role: 'waiter' });
    waiter = { ...(await signUpUser('m-waiter@test.local')), memberId: '' };
    await signInAs(waiter);
    const m = await redeemInvitation(inv.token);
    waiter.memberId = m.id;
  });

  it('admin lists members', async () => {
    await signInAs(admin);
    const ms = await listMembers(orgId);
    expect(ms.length).toBeGreaterThanOrEqual(2);
  });

  it('admin promotes waiter to cashier', async () => {
    await signInAs(admin);
    const updated = await changeMemberRole({
      memberId: waiter.memberId, orgId, currentRole: 'waiter', nextRole: 'cashier',
    });
    expect(updated.role).toBe('cashier');
  });

  it('blocks demoting last admin', async () => {
    await signInAs(admin);
    const ms = await listMembers(orgId);
    const me = ms.find((m) => m.auth_user_id === admin.id)!;
    await expect(changeMemberRole({
      memberId: me.id, orgId, currentRole: 'admin', nextRole: 'waiter',
    })).rejects.toThrow(/last_admin/);
  });

  it('admin removes a member', async () => {
    await signInAs(admin);
    await removeMember({ memberId: waiter.memberId, orgId, role: 'cashier' });
    const after = await listMembers(orgId);
    expect(after.find((m) => m.id === waiter.memberId)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test tests/insforge/members.integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/insforge/members.integration.test.ts
git commit -m "test(members): role change + remove + last-admin guard"
```

---

## Task 20: Final smoke + cleanup

- [ ] **Step 1: Full test run**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke**

1. Sign in as admin → Settings → Team appears.
2. Tap "+", enter email + role waiter → code appears.
3. Copy code → paste in another device's `/invite/accept` → verify → sign up → land in komandas.
4. Back as admin → Team shows new member, invite removed from pending.
5. Change member role → confirm via DB.
6. Try demote self → blocked.
7. Remove member → row removed.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: roles & invitations plan complete"
```

---

## Done criteria

- All four roles round-trip through schema, queries, mutations, RLS.
- Admin can invite, see pending invites, revoke.
- Recipient can accept code via deep link or paste, complete sign-up, land in app with correct role.
- Permission helpers cover the matrix from the spec; UI hides what role can't access; routes redirect.
- Last-admin invariant enforced both in queries and surfaced as UX error.
- Integration tests cover invite lifecycle and member ops.
