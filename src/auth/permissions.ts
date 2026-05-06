export type Role = 'admin' | 'cashier' | 'waiter' | 'cook';

export const can = {
  manageMenu:      (r: Role) => r === 'admin' || r === 'cashier',
  workKomanda:     (r: Role) => r !== 'cook',
  closeKomanda:    (r: Role) => r !== 'cook',
  registerExpense: (r: Role) => r === 'admin' || r === 'cashier',
  viewAudit:       (r: Role) => r === 'admin' || r === 'cashier',
  inviteUsers:     (r: Role) => r === 'admin',
  viewKitchen:     (r: Role) => r === 'admin' || r === 'cook',
  /**
   * Receives a notification when a new komanda is created. Waiters are
   * the ones creating them so they already know — kitchen + management
   * are the ones who need to react ("press the cooks", check the table).
   */
  receivesKomandaCreatedNotif: (r: Role) => r !== 'waiter',
};
