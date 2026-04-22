import { useEffect, useState } from 'react';
import { queueStore } from './handlers';
import { getAll, type QueuedMutation } from './queue';

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
