import type { HandlerRegistry } from '@/offline/processor';
import { createLocalStore } from '@/offline/localStore';
import { createQueueStore } from '@/offline/queue';
import { createKomandaHandler } from './createKomanda';
import { renameKomandaHandler } from './renameKomanda';
import { updateStatusHandler } from './updateStatus';
import { addItemHandler } from './addItem';
import { updateItemHandler } from './updateItem';
import { removeItemHandler } from './removeItem';
import { closeKomandaHandler } from './closeKomanda';

export const queueStore = createQueueStore();
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
