import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { rememberSync, type LocalStore } from '@/offline/localStore';
import { fetchMyMembership } from '@/insforge/queries/membership';

export interface CreateKomandaPayload {
  local_uuid: string;
  display_name: string | null;
  opened_at: string; // ISO
}

export interface WriteContext {
  orgId: string;
  authUserId: string;
}

export type WriteContextResolver = () => Promise<WriteContext>;

function yyyyMmDd(iso: string): string {
  // Slice the date part directly from the ISO string to avoid local-timezone shifts.
  return iso.slice(0, 10);
}

/**
 * Cache of { org_id, auth_user_id } across drains. Refreshed on first miss
 * or when the handler is explicitly reset (sign-out clears the cache; the
 * next fetch refills). Keeping this in module scope avoids hitting the
 * membership endpoint on every single drain tick.
 */
let _cachedContext: WriteContext | null = null;

/** Default resolver — reads the current user's membership once per session. */
export const defaultResolveWriteContext: WriteContextResolver = async () => {
  if (_cachedContext) return _cachedContext;
  const m = await fetchMyMembership();
  if (!m) {
    throw new Error(
      'create_komanda: no organization membership for current user — cannot insert',
    );
  }
  _cachedContext = { orgId: m.org_id, authUserId: m.auth_user_id };
  return _cachedContext;
};

/** Sign-out hook: drop the cached context so the next user resolves fresh. */
export function resetCreateKomandaContext(): void {
  _cachedContext = null;
}

export function createKomandaHandler(deps: {
  localStore: LocalStore;
  resolveWriteContext?: WriteContextResolver;
}) {
  const resolve = deps.resolveWriteContext ?? defaultResolveWriteContext;
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as CreateKomandaPayload;

    // Belt & braces: we used to rely on the `set_komanda_defaults` trigger to
    // populate org_id / opened_by_auth_user_id. If the trigger is missing, or
    // `current_org_id()` can't resolve (no membership row), the insert gets
    // rejected by RLS. Setting both explicitly here means the insert succeeds
    // regardless of trigger state, and any org-resolution failure surfaces
    // with a clear message instead of a cryptic RLS reject.
    const ctx = await resolve();

    const { data: number, error: rpcErr } = await insforge.database.rpc('next_komanda_number', {
      p_date: yyyyMmDd(payload.opened_at),
    });
    if (rpcErr) throw rpcErr;

    const { data, error } = await insforge.database
      .from('komandas')
      .insert({
        org_id: ctx.orgId,
        opened_by_auth_user_id: ctx.authUserId,
        number,
        display_name: payload.display_name,
        status: 'open',
        opened_at: payload.opened_at,
        local_uuid: payload.local_uuid,
      })
      .select('*')
      .single();
    if (error) throw error;

    await rememberSync(deps.localStore, payload.local_uuid, data.id);
  };
}
