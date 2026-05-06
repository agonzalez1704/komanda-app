import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import type { KomandaRowT, KomandaStatusT } from '@/insforge/schemas';

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { komanda_id: string; status: KomandaStatusT }) => {
      // Optimistically stamp updated_at locally too so list ordering /
      // "last touched by" UI reflects the change immediately. The server
      // trigger (0013_komanda_audit_and_realtime.sql) re-stamps the
      // authoritative value when the queued mutation drains.
      const now = new Date().toISOString();
      qc.setQueryData<KomandaRowT>(['komanda', input.komanda_id], (prev) =>
        prev ? { ...prev, status: input.status, updated_at: now } : prev,
      );
      qc.setQueryData<KomandaRowT[]>(['komandas', 'today'], (prev) =>
        prev?.map((k) =>
          k.id === input.komanda_id
            ? { ...k, status: input.status, updated_at: now }
            : k,
        ),
      );
      await enqueue(queueStore, { type: 'update_status', payload: input });
    },
  });
}
