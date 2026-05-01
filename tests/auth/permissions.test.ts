import { can, type Role } from '@/auth/permissions';

const roles: Role[] = ['admin', 'cashier', 'waiter', 'cook'];

describe('permissions matrix', () => {
  const matrix: Record<keyof typeof can, Record<Role, boolean>> = {
    manageMenu:      { admin: true,  cashier: true,  waiter: false, cook: false },
    workKomanda:     { admin: true,  cashier: true,  waiter: true,  cook: false },
    closeKomanda:    { admin: true,  cashier: true,  waiter: true,  cook: false },
    registerExpense: { admin: true,  cashier: true,  waiter: false, cook: false },
    viewAudit:       { admin: true,  cashier: true,  waiter: false, cook: false },
    inviteUsers:     { admin: true,  cashier: false, waiter: false, cook: false },
    viewKitchen:     { admin: true,  cashier: false, waiter: false, cook: true  },
  };

  for (const [action, byRole] of Object.entries(matrix)) {
    for (const r of roles) {
      it(`${action}(${r}) === ${byRole[r]}`, () => {
        expect(can[action as keyof typeof can](r)).toBe(byRole[r]);
      });
    }
  }
});
