import { useMutation, useQueryClient } from '@tanstack/react-query';
import 'react-native-get-random-values';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { useSession } from '@/insforge/session';
import type { KomandaRowT } from '@/insforge/schemas';

export function useCreateKomanda() {
  const qc = useQueryClient();
  const session = useSession();

  return useMutation({
    mutationFn: async (input: { display_name: string | null }) => {
      if (session.status !== 'signed-in') throw new Error('not_signed_in');
      const local_uuid = (globalThis.crypto as any).randomUUID();
      const opened_at = new Date().toISOString();

      const optimistic: KomandaRowT = {
        id: local_uuid,
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
