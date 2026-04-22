import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnline } from './network';
import { drainQueue } from './processor';
import { handlers, queueStore } from './handlers';

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
        await qc.invalidateQueries();
      } catch {
        // drainQueue already stores errors on each mutation; nothing more to do here.
      } finally {
        draining.current = false;
      }
    })();
  }, [online, qc]);
}
