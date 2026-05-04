import { resolveId, type LocalStore } from '@/offline/localStore';
import { deleteKomandaCombo } from '@/insforge/queries/komandaCombos';
import type { QueuedMutation } from '@/offline/queue';

export interface RemoveComboPayload {
  /** local-uuid or server uuid; resolved at run-time */
  combo_id: string;
}

export function removeComboHandler(deps: { localStore: LocalStore }) {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as RemoveComboPayload;
    const id = await resolveId(deps.localStore, p.combo_id);
    await deleteKomandaCombo(id);
  };
}
