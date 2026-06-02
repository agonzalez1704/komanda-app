/**
 * Pure margin & break-even calculations for the admin "Margins & Costs"
 * screen. No DB, no React — all inputs are plain primitives so this module is
 * trivially unit-testable.
 *
 * All monetary values are integers in cents to stay consistent with the rest
 * of the codebase (see src/domain/money.ts, src/domain/total.ts). Ingredient
 * costs may include fractional cents (numeric(12,4) in Postgres); we round
 * once at the per-portion boundary to avoid drift across many tacos.
 *
 * Sources of truth:
 *   - Uber Eats deductions (commission, IVA retention) and markup factors
 *     come from the per-org `margin_assumptions` row.
 *   - Ingredient cost per portion is sum over recipe lines of
 *     (cost_cents_per_unit × quantity).
 */

import type { IngredientUnitT } from '@/insforge/schemas';

// ---------------------------------------------------------------------------
// Inputs (decoupled from DB row types so tests can construct them inline).
// ---------------------------------------------------------------------------

export interface MarginAssumptions {
  uberCommissionPct: number;     // 0..1, e.g. 0.3464
  uberIvaRetentionPct: number;   // 0..1, e.g. 0.0951
  markupA: number;               // > 1, e.g. 1.53
  markupB: number;               // > 1, e.g. 1.79
}

export interface Ingredient {
  id: string;
  unit: IngredientUnitT;          // 'g' | 'ml' | 'unit'
  costCentsPerUnit: number;       // may be fractional (e.g. 2.2 ¢/g)
}

export interface RecipeLine {
  ingredientId: string;
  quantity: number;               // in the ingredient's unit
}

export type UberFactor = 'A' | 'B';

// ---------------------------------------------------------------------------
// Core calcs
// ---------------------------------------------------------------------------

/**
 * Ingredient cost for one portion of a product. Returns integer cents
 * (rounded once at the end). Throws if a recipe line references an
 * ingredient not present in the catalog — fail fast rather than silently
 * undercounting cost.
 */
export function ingredientCostCents(
  recipe: RecipeLine[],
  ingredients: Ingredient[]
): number {
  if (recipe.length === 0) return 0;
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  let total = 0;
  for (const line of recipe) {
    const ing = byId.get(line.ingredientId);
    if (!ing) {
      throw new Error(
        `ingredientCostCents: missing ingredient ${line.ingredientId}`
      );
    }
    total += ing.costCentsPerUnit * line.quantity;
  }
  return Math.round(total);
}

/**
 * Derived Uber Eats sale price (cents) from in-store price and chosen markup
 * factor. Rounded to whole cents — the UI rounds to whole pesos separately
 * if desired (see derivedUberPriceCentsRounded below).
 */
export function derivedUberPriceCents(
  inStoreCents: number,
  factor: UberFactor,
  assumptions: MarginAssumptions
): number {
  const mult = factor === 'A' ? assumptions.markupA : assumptions.markupB;
  return Math.round(inStoreCents * mult);
}

/** Same as derivedUberPriceCents but rounded to whole pesos (100 cents). */
export function derivedUberPriceCentsRounded(
  inStoreCents: number,
  factor: UberFactor,
  assumptions: MarginAssumptions
): number {
  const raw = derivedUberPriceCents(inStoreCents, factor, assumptions);
  return Math.round(raw / 100) * 100;
}

/**
 * Effective Uber Eats sale price for a product: explicit override if set,
 * otherwise derived from price_cents × markup factor.
 */
export function effectiveUberPriceCents(
  priceCents: number,
  uberPriceCentsOverride: number | null | undefined,
  factor: UberFactor,
  assumptions: MarginAssumptions
): number {
  if (uberPriceCentsOverride != null) return uberPriceCentsOverride;
  return derivedUberPriceCents(priceCents, factor, assumptions);
}

/**
 * Net the seller receives per Uber Eats sale, after Uber's commission (and
 * IVA on commission) AND the IVA Uber retains on the sale. If `withIvaRetention`
 * is false, only the commission is deducted — use that mode if the org
 * remits its own IVA and the retention is recoverable.
 */
export function uberNetCents(
  uberPriceCents: number,
  assumptions: MarginAssumptions,
  withIvaRetention: boolean = true
): number {
  const deductionPct =
    assumptions.uberCommissionPct +
    (withIvaRetention ? assumptions.uberIvaRetentionPct : 0);
  return Math.round(uberPriceCents * (1 - deductionPct));
}

export interface MarginPerUnit {
  inStoreCents: number;            // price_cents − ingredient cost
  uberEatsCents: number;           // uberNetCents − ingredient cost
}

/**
 * Margin per unit on both channels. Negative margin is allowed in the
 * return — the UI surfaces a warning instead of silently clamping.
 */
export function marginPerUnit(args: {
  priceCents: number;
  uberPriceCents: number;          // resolve via effectiveUberPriceCents first
  ingredientCostCents: number;
  assumptions: MarginAssumptions;
  withIvaRetention?: boolean;
}): MarginPerUnit {
  const uberNet = uberNetCents(
    args.uberPriceCents,
    args.assumptions,
    args.withIvaRetention ?? true
  );
  return {
    inStoreCents: args.priceCents - args.ingredientCostCents,
    uberEatsCents: uberNet - args.ingredientCostCents,
  };
}

/**
 * Daily break-even quantity: how many units must be sold to cover fixed
 * costs, given an average per-unit margin. Returns Infinity if the margin is
 * non-positive (you can never break even on negative-margin items).
 */
export function dailyBreakEvenUnits(
  fixedDailyCostCents: number,
  avgMarginCents: number
): number {
  if (avgMarginCents <= 0) return Infinity;
  return Math.ceil(fixedDailyCostCents / avgMarginCents);
}
