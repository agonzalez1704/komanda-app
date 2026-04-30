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
import { createExpenseHandler } from './createExpense';

export const queueStore = createQueueStore();
export const localStore = createLocalStore();

export const handlers: HandlerRegistry = {
  create_komanda: createKomandaHandler({ localStore }),
  rename_komanda: renameKomandaHandler({ localStore, queueStore }),
  update_status: updateStatusHandler({ localStore, queueStore }),
  add_item: addItemHandler({ localStore, queueStore }),
  update_item: updateItemHandler({ localStore, queueStore }),
  remove_item: removeItemHandler({ localStore, queueStore }),
  close_komanda: closeKomandaHandler({ localStore, queueStore }),
  upsert_product: upsertProductHandler({ localStore }),
  delete_product: deleteProductHandler({ localStore }),
  upsert_variant: upsertVariantHandler({ localStore }),
  delete_variant: deleteVariantHandler({ localStore }),
  upsert_modifier: upsertModifierHandler({ localStore }),
  delete_modifier: deleteModifierHandler({ localStore }),
  create_expense: createExpenseHandler(),
};
