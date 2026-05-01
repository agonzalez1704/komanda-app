export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditExpense(args: {
  expense: { created_by_auth_user_id: string; created_at: string; voided: boolean };
  period: { status: 'open' | 'closed' };
  currentUserId: string;
  now: number;
}): boolean {
  if (args.expense.voided) return false;
  if (args.period.status !== 'open') return false;
  if (args.expense.created_by_auth_user_id !== args.currentUserId) return false;
  const age = args.now - new Date(args.expense.created_at).getTime();
  return age < EDIT_WINDOW_MS;
}
