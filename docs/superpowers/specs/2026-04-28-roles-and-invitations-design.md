# Roles & Invitations — Design

**Date:** 2026-04-28
**Status:** Approved
**Scope:** Spec 1 of 2 (paired with `2026-04-28-expenses-and-audit-design.md`)

## Goal

Allow admins to invite teammates into their organization with assigned roles. Replace the binary `admin | member` role model with four explicit job roles (`admin`, `cashier`, `waiter`, `cook`) and gate features by role.

## Non-goals

- Email sending infrastructure (invite codes are shared manually)
- Multi-org membership for a single user (one user → one org for now)
- Audit log of role changes (out of scope)
- SSO / external IdP

## Roles

| Role | Description |
|------|-------------|
| `admin` | Full access. Manages team, menu, money, and operations. |
| `cashier` | Manages menu, money (close komandas, expenses, audit). Works komandas. |
| `waiter` | Opens komandas, adds items, closes with payment. No menu/money admin. |
| `cook` | Read-only kitchen queue. No komanda or money operations. |

### Permission matrix

| Action | admin | cashier | waiter | cook |
|---|---|---|---|---|
| Manage menu (CRUD products/variants/modifiers) | ✓ | ✓ | ✗ | ✗ |
| Open komanda + add items | ✓ | ✓ | ✓ | ✗ |
| Close komanda + payment | ✓ | ✓ | ✓ | ✗ |
| Register expenses | ✓ | ✓ | ✗ | ✗ |
| View audit / profits | ✓ | ✓ | ✗ | ✗ |
| Invite users / manage team | ✓ | ✗ | ✗ | ✗ |
| View kitchen queue | ✓ | ✗ | ✗ | ✓ |

## Data model

### `organization_members.role` migration

```ts
role: z.enum(['admin', 'cashier', 'waiter', 'cook'])
```

Migration: existing rows with `role='member'` → `role='waiter'`.

### `invitations` (extends current schema)

```ts
export const InvitationRow = z.object({
  id: uuid,
  org_id: uuid,
  email: z.string().email(),
  role: z.enum(['admin', 'cashier', 'waiter', 'cook']),
  token: z.string(),                          // 8-char base32, formatted "XXXX-XXXX"
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expires_at: iso,                            // default created_at + 7d
  accepted_at: iso.nullable(),
  accepted_by_auth_user_id: uuid.nullable(),
  created_by_auth_user_id: uuid,
  created_at: iso,
});
```

Invariants:
- Single-use: once `status='accepted'`, code dead.
- Revocable: admin sets `status='revoked'` any time before acceptance.
- Auto-expire: lookup rejects if `expires_at < now()` (status stays `pending`, optional sweeper job sets `expired`).

### Permission helper

```ts
// src/auth/permissions.ts
export type Role = 'admin' | 'cashier' | 'waiter' | 'cook';

export const can = {
  manageMenu: (r: Role) => r === 'admin' || r === 'cashier',
  workKomanda: (r: Role) => r !== 'cook',
  registerExpense: (r: Role) => r === 'admin' || r === 'cashier',
  viewAudit: (r: Role) => r === 'admin' || r === 'cashier',
  inviteUsers: (r: Role) => r === 'admin',
  viewKitchen: (r: Role) => r === 'admin' || r === 'cook',
};
```

## Screens

### S1. Settings → Team row
Visible only to admins. Pushes to `/settings/team`.

### S2. Team screen `/settings/team`
- Header: "Team" + back
- Section "Members": `[avatar | display_name | role badge | overflow menu]`
- Section "Pending invites": `[email | role | "expires in Nd" | revoke btn]`
- FAB "+" → invite modal

### S3. Invite modal (bottom sheet)
- Email input
- Role segmented control: `admin / cashier / waiter / cook`
- "Generate invite" button
- On success: shows code (formatted `K4M9-X2P7`), copy button, share button (system share sheet)
- Toast: "Code valid 7 days"

### S4. Accept invite `/invite/accept` (public route, deep link)
- Code input (auto-fill from `?code=XXXX-XXXX` query param)
- "Verify code" button → preview org name + assigned role
- "Display name" input (required, used for `organization_members.display_name`)
- If signed-in: "Join {org}" button
- If not signed-in: "Create account" form (email+pw, email pre-filled from invite)
- On success → redirect `/(app)/komandas`

### S5. Member overflow menu (admin-only)
- "Change role" → role picker sub-sheet
- "Remove from org" → confirm dialog

## Data flow

### Generate invite
1. Validate email + role + caller is admin
2. Insert `invitations` row: `token=randomCode()`, `status='pending'`, `expires_at=now+7d`
3. Return code; display in modal

### Accept invite
1. Lookup `invitations` by `token`
2. Reject if not found / `status != 'pending'` / `expires_at < now`
3. If user not signed-in → sign-up flow (auth account creation)
4. Reject if user already in `organization_members` for this `org_id`
5. Insert `organization_members` row: `org_id`, `auth_user_id`, `role`, `display_name` (from accept form)
6. Update invitation: `status='accepted'`, `accepted_at=now`, `accepted_by_auth_user_id`

### Revoke
Admin sets `status='revoked'`. Acceptance attempts blocked.

### Change role
Update `organization_members.role`. Last-admin guard: reject if change would drop org admin count below 1.

### Remove member
Hard delete `organization_members` row. Historical FKs (`opened_by_auth_user_id`, etc.) on komandas/expenses remain — record retained as historical reference. Last-admin guard applies.

## Authorization

- **UI gating:** `can.*` helpers hide nav items, buttons, and routes.
- **Server gating:** InsForge RLS.
  - `organization_members`: read = same org membership. write = `role='admin'` in same org.
  - `invitations`: read = admin of org OR public lookup by exact `token`. write = admin of org.
  - Existing tables (`products`, `komandas`, etc.): tighten RLS to enforce role-based access per matrix.

## Error states

| Case | UX |
|---|---|
| Code invalid / not found | Red banner: "Code is invalid" |
| Code expired | Red banner: "This invite has expired. Ask your admin for a new one." |
| Code already used / revoked | Red banner: "This invite is no longer valid." |
| User already in org | Banner: "You're already a member of {org}." |
| Network fail on generate | Toast: "Couldn't create invite. Tap to retry." |
| Last-admin remove/demote | Modal: "Cannot remove the last admin. Promote another member first." |

## Testing

**Unit**
- `src/auth/permissions.ts` — every role × every action returns expected boolean
- `randomCode()` — format, no collisions over 10k samples

**Integration** (real InsForge per project convention)
- Invite lifecycle: generate → accept → already-used rejected
- Revoke flow: generate → revoke → accept rejected
- Expiry: generate → manually advance `expires_at` → accept rejected
- Role change: admin demotes member; last-admin guard blocks self-demote
- Remove member: succeeds; last-admin guard blocks removing last admin

**E2E**
- Full happy path: admin generates invite → recipient deep-links to `/invite/accept?code=...` → signs up → lands in `/(app)/komandas` with correct role-gated nav

## Open questions

None. All resolved during brainstorming.

## Out of scope (deferred)

- Email delivery of invite codes
- Audit log of admin actions (role changes, removals, invites)
- Per-screen role-specific dashboards (cook screen content TBD in a future spec)
