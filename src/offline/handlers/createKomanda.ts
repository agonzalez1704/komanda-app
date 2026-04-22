import { insforge } from '@/insforge/client';
import type { QueuedMutation } from '@/offline/queue';
import { rememberSync, type LocalStore } from '@/offline/localStore';

export interface CreateKomandaPayload {
  local_uuid: string;
  display_name: string | null;
  opened_at: string; // ISO
}

function yyyyMmDd(iso: string): string {
  // Slice the date part directly from the ISO string to avoid local-timezone shifts.
  return iso.slice(0, 10);
}

export function createKomandaHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const payload = m.payload as CreateKomandaPayload;

    const { data: number, error: rpcErr } = await insforge.database.rpc('next_komanda_number', {
      p_date: yyyyMmDd(payload.opened_at),
    });
    if (rpcErr) throw rpcErr;

    const { data, error } = await insforge.database
      .from('komandas')
      .insert({
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
