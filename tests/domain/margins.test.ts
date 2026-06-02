import {
  dailyBreakEvenUnits,
  derivedUberPriceCents,
  derivedUberPriceCentsRounded,
  effectiveUberPriceCents,
  ingredientCostCents,
  marginPerUnit,
  uberNetCents,
  type Ingredient,
  type MarginAssumptions,
  type RecipeLine,
} from '@/domain/margins';

// Defaults match supabase-sql/0018_margins_and_costs.sql and the validated
// numbers in Taqueria_UberEats_Pricing.xlsx (sheet "Assumptions").
const DEFAULT_ASSUMPTIONS: MarginAssumptions = {
  uberCommissionPct: 0.3464,
  uberIvaRetentionPct: 0.0951,
  markupA: 1.53,
  markupB: 1.79,
};

// Catalog mirroring the spreadsheet (cost_cents_per_unit = pesos/kg × 100 / 1000
// for solids → ¢/g). E.g. tortilla maíz $22/kg = 2.2 ¢/g.
const TORTILLA: Ingredient = { id: 'tort',     unit: 'g',    costCentsPerUnit: 2.2  };
const BISTECK:  Ingredient = { id: 'bisteck',  unit: 'g',    costCentsPerUnit: 15.0 };
const COSTILLA: Ingredient = { id: 'costilla', unit: 'g',    costCentsPerUnit: 11.936 };
const BREAD:    Ingredient = { id: 'bread',    unit: 'unit', costCentsPerUnit: 250  };

// Standard taco recipe: 2 tortillas × 30 g + 22.5 g of meat.
const tacoRecipe = (meatId: string): RecipeLine[] => [
  { ingredientId: 'tort', quantity: 60 },
  { ingredientId: meatId, quantity: 22.5 },
];

describe('ingredientCostCents', () => {
  it('returns 0 for an empty recipe', () => {
    expect(ingredientCostCents([], [TORTILLA, BISTECK])).toBe(0);
  });

  it('matches the spreadsheet for a bisteck taco (~470 cents)', () => {
    // tortillas: 2.2 × 60 = 132 ¢ ; bisteck: 15.0 × 22.5 = 337.5 ¢ → 469.5 → 470.
    expect(ingredientCostCents(tacoRecipe('bisteck'), [TORTILLA, BISTECK])).toBe(470);
  });

  it('matches the spreadsheet for a costilla taco (~401 cents)', () => {
    // tortillas 132 + costilla 11.936 × 22.5 = 268.56 → total 400.56 → 401.
    expect(ingredientCostCents(tacoRecipe('costilla'), [TORTILLA, COSTILLA])).toBe(401);
  });

  it('handles unit-priced ingredients (torta bread)', () => {
    expect(ingredientCostCents([{ ingredientId: 'bread', quantity: 1 }], [BREAD])).toBe(250);
  });

  it('throws if a recipe line references an unknown ingredient', () => {
    expect(() =>
      ingredientCostCents([{ ingredientId: 'ghost', quantity: 1 }], [TORTILLA])
    ).toThrow(/missing ingredient ghost/);
  });
});

describe('derivedUberPriceCents', () => {
  it('applies markup A (×1.53) to an in-store price', () => {
    // $19 × 1.53 = $29.07 → 2907 ¢
    expect(derivedUberPriceCents(1900, 'A', DEFAULT_ASSUMPTIONS)).toBe(2907);
  });

  it('applies markup B (×1.79)', () => {
    // $19 × 1.79 = $34.01 → 3401 ¢
    expect(derivedUberPriceCents(1900, 'B', DEFAULT_ASSUMPTIONS)).toBe(3401);
  });

  it('rounds to whole pesos when requested (spreadsheet behaviour)', () => {
    // $19 × 1.53 = $29.07 → rounded to $29 (2900 ¢).
    expect(derivedUberPriceCentsRounded(1900, 'A', DEFAULT_ASSUMPTIONS)).toBe(2900);
    // Promo 1: $69 × 1.53 = $105.57 → rounded to $106 (10600 ¢).
    expect(derivedUberPriceCentsRounded(6900, 'A', DEFAULT_ASSUMPTIONS)).toBe(10600);
  });
});

describe('effectiveUberPriceCents', () => {
  it('returns the override when set', () => {
    expect(effectiveUberPriceCents(1900, 3500, 'A', DEFAULT_ASSUMPTIONS)).toBe(3500);
  });

  it('falls back to derived when override is null', () => {
    expect(effectiveUberPriceCents(1900, null, 'A', DEFAULT_ASSUMPTIONS)).toBe(2907);
  });

  it('falls back to derived when override is undefined', () => {
    expect(effectiveUberPriceCents(1900, undefined, 'A', DEFAULT_ASSUMPTIONS)).toBe(2907);
  });
});

describe('uberNetCents', () => {
  it('deducts commission + IVA retention by default (total ~44.15%)', () => {
    // $29 × (1 − 0.3464 − 0.0951) = $29 × 0.5585 = $16.197 → 1620 ¢.
    expect(uberNetCents(2900, DEFAULT_ASSUMPTIONS)).toBe(1620);
  });

  it('deducts only commission when withIvaRetention=false (~$18.95 on $29)', () => {
    // $29 × (1 − 0.3464) = $29 × 0.6536 = $18.9544 → 1895 ¢.
    expect(uberNetCents(2900, DEFAULT_ASSUMPTIONS, false)).toBe(1895);
  });
});

describe('marginPerUnit', () => {
  it('computes both channels for a bisteck taco (Option A pricing, commission-only mode)', () => {
    // In-store: $19 − $4.70 = $14.30 → 1430 ¢
    // Uber net (no IVA retention): $18.95 − $4.70 = $14.25 → ~1425 ¢
    const m = marginPerUnit({
      priceCents: 1900,
      uberPriceCents: 2900,
      ingredientCostCents: 470,
      assumptions: DEFAULT_ASSUMPTIONS,
      withIvaRetention: false,
    });
    expect(m.inStoreCents).toBe(1430);
    expect(m.uberEatsCents).toBe(1425);
  });

  it('allows negative margin (no clamping) so the UI can warn', () => {
    const m = marginPerUnit({
      priceCents: 1000,
      uberPriceCents: 1500,
      ingredientCostCents: 2000,
      assumptions: DEFAULT_ASSUMPTIONS,
    });
    expect(m.inStoreCents).toBeLessThan(0);
    expect(m.uberEatsCents).toBeLessThan(0);
  });
});

describe('dailyBreakEvenUnits', () => {
  it('rounds up (you cannot break even on a fractional taco)', () => {
    // $766.67 fixed (76667 ¢) at $14.30 margin (1430 ¢) → 54 tacos.
    expect(dailyBreakEvenUnits(76667, 1430)).toBe(54);
  });

  it('returns Infinity when margin is zero or negative', () => {
    expect(dailyBreakEvenUnits(76667, 0)).toBe(Infinity);
    expect(dailyBreakEvenUnits(76667, -100)).toBe(Infinity);
  });

  it('returns 0 when there are no fixed costs', () => {
    expect(dailyBreakEvenUnits(0, 1430)).toBe(0);
  });
});
