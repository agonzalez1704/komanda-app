/**
 * Komanda lifecycle state machine.
 *
 * Canonical lifecycle:
 *   pending → served            (waiter delivered the food)
 *   served  → pending            (table ordered more — back into the kitchen)
 *   served  → closed             (paid)
 *   closed  → ∅                  (terminal — closing flow handles re-open
 *                                  via a separate reopen RPC, not via the
 *                                  status segment)
 *
 * 'open' is a deprecated legacy bucket; treat it as 'pending' for any
 * surface decision but never write it back to the DB.
 */

import type { KomandaStatusT } from '@/insforge/schemas';

/** Statuses a user can move a komanda INTO via the status segment + swipe. */
export type ManualStatus = Extract<KomandaStatusT, 'pending' | 'served' | 'closed'>;

const ALLOWED: Record<KomandaStatusT, ManualStatus[]> = {
  // Legacy 'open' rows — treat as pending for transition purposes.
  open: ['served'],
  pending: ['served'],
  served: ['pending', 'closed'],
  closed: [],
  cancelled: [],
};

/** Cancellation is a terminal one-way transition, separate from the
 *  manual status segment. Cancelling a closed komanda is forbidden — once
 *  paid the audit trail is sealed; voiding requires a refund flow. */
export function canCancelKomanda(from: KomandaStatusT): boolean {
  return from !== 'closed' && from !== 'cancelled';
}

export function canTransitionStatus(
  from: KomandaStatusT,
  to: ManualStatus,
): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function nextManualStatuses(from: KomandaStatusT): ManualStatus[] {
  return ALLOWED[from];
}

/**
 * Effective status for display — collapses the deprecated 'open' bucket
 * into 'pending' so the UI only ever surfaces 3 user-meaningful states.
 */
export function effectiveStatus(s: KomandaStatusT): ManualStatus | 'cancelled' {
  if (s === 'open') return 'pending';
  return s;
}

/**
 * Reasons a transition might be blocked beyond the lifecycle itself.
 * `null` means the move is allowed.
 *
 * Content rules:
 *   - You can't mark an empty komanda as served — there's nothing to deliver.
 *   - You can't close (cobrar) an empty komanda — there's nothing to charge.
 *
 * Returning a reason code (not a sentence) lets each surface render the
 * message in its own language/tone (Spanish app copy, English logs).
 */
export type BlockReason =
  | 'invalid_transition'
  | 'no_items';

export function transitionBlockedReason(
  from: KomandaStatusT,
  to: ManualStatus,
  ctx: { itemCount: number },
): BlockReason | null {
  if (!canTransitionStatus(from, to)) return 'invalid_transition';
  if ((to === 'served' || to === 'closed') && ctx.itemCount === 0) {
    return 'no_items';
  }
  return null;
}

/** Spanish-localized message for a block reason. */
export function blockReasonMessage(r: BlockReason): string {
  switch (r) {
    case 'invalid_transition':
      return 'Esa transición de estado no está permitida.';
    case 'no_items':
      return 'Agrega al menos un platillo antes de marcar la komanda.';
  }
}
