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
import { upsertProductHandler } from './upsertProduct';
import { deleteProductHandler } from './deleteProduct';
import { upsertVariantHandler } from './upsertVariant';
import { deleteVariantHandler } from './deleteVariant';
import { upsertModifierHandler } from './upsertModifier';
import { deleteModifierHandler } from './deleteModifier';

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
  upsert_product: upsertProductHandler({ localStore }),
  delete_product: deleteProductHandler({ localStore }),
  upsert_variant: upsertVariantHandler({ localStore }),
  delete_variant: deleteVariantHandler({ localStore }),
  upsert_modifier: upsertModifierHandler({ localStore }),
  delete_modifier: deleteModifierHandler({ localStore }),
};
