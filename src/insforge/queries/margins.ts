import { z } from 'zod';
import { insforge } from '@/insforge/client';
import {
  FixedCostRow,
  IngredientRow,
  MarginAssumptionsRow,
  ProductRecipeLineRow,
  type FixedCostRowT,
  type IngredientRowT,
  type IngredientUnitT,
  type MarginAssumptionsRowT,
  type ProductRecipeLineRowT,
} from '@/insforge/schemas';

// ---------------------------------------------------------------------------
// margin_assumptions (one row per org)
// ---------------------------------------------------------------------------

export async function fetchMarginAssumptions(
  orgId: string
): Promise<MarginAssumptionsRowT | null> {
  const { data, error } = await insforge.database
    .from('margin_assumptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return MarginAssumptionsRow.parse(data);
}

export async function upsertMarginAssumptions(input: {
  orgId: string;
  uberCommissionPct: number;
  uberIvaRetentionPct: number;
  markupA: number;
  markupB: number;
}): Promise<MarginAssumptionsRowT> {
  const row = {
    org_id: input.orgId,
    uber_commission_pct: input.uberCommissionPct,
    uber_iva_retention_pct: input.uberIvaRetentionPct,
    markup_a: input.markupA,
    markup_b: input.markupB,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await insforge.database
    .from('margin_assumptions')
    .upsert(row)
    .select('*')
    .single();
  if (error) throw error;
  return MarginAssumptionsRow.parse(data);
}

// ---------------------------------------------------------------------------
// ingredients
// ---------------------------------------------------------------------------

const IngredientList = z.array(IngredientRow);

export async function fetchIngredients(
  orgId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<IngredientRowT[]> {
  let q = insforge.database
    .from('ingredients')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true });
  if (opts.activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return IngredientList.parse(data ?? []);
}

export async function upsertIngredient(input: {
  id?: string;
  orgId: string;
  name: string;
  unit: IngredientUnitT;
  costCentsPerUnit: number;
  active?: boolean;
}): Promise<IngredientRowT> {
  const row: Record<string, unknown> = {
    org_id: input.orgId,
    name: input.name,
    unit: input.unit,
    cost_cents_per_unit: input.costCentsPerUnit,
    active: input.active ?? true,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await insforge.database
    .from('ingredients')
    .upsert(row)
    .select('*')
    .single();
  if (error) throw error;
  return IngredientRow.parse(data);
}

// ---------------------------------------------------------------------------
// product_recipe_lines
// ---------------------------------------------------------------------------

const RecipeLineList = z.array(ProductRecipeLineRow);

/** All recipe lines across the org — for the overview screen. */
export async function fetchAllRecipeLines(
  orgId: string
): Promise<ProductRecipeLineRowT[]> {
  const { data, error } = await insforge.database
    .from('product_recipe_lines')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;
  return RecipeLineList.parse(data ?? []);
}

export async function fetchRecipeLinesForProduct(
  productId: string
): Promise<ProductRecipeLineRowT[]> {
  const { data, error } = await insforge.database
    .from('product_recipe_lines')
    .select('*')
    .eq('product_id', productId);
  if (error) throw error;
  return RecipeLineList.parse(data ?? []);
}

export async function upsertRecipeLine(input: {
  id?: string;
  orgId: string;
  productId: string;
  ingredientId: string;
  quantity: number;
}): Promise<ProductRecipeLineRowT> {
  const row: Record<string, unknown> = {
    org_id: input.orgId,
    product_id: input.productId,
    ingredient_id: input.ingredientId,
    quantity: input.quantity,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await insforge.database
    .from('product_recipe_lines')
    .upsert(row, { onConflict: 'product_id,ingredient_id' })
    .select('*')
    .single();
  if (error) throw error;
  return ProductRecipeLineRow.parse(data);
}

export async function deleteRecipeLine(id: string): Promise<void> {
  const { error } = await insforge.database
    .from('product_recipe_lines')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// fixed_costs
// ---------------------------------------------------------------------------

const FixedCostList = z.array(FixedCostRow);

export async function fetchFixedCosts(
  orgId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<FixedCostRowT[]> {
  let q = insforge.database
    .from('fixed_costs')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });
  if (opts.activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return FixedCostList.parse(data ?? []);
}

export async function upsertFixedCost(input: {
  id?: string;
  orgId: string;
  label: string;
  dailyCents: number;
  notes?: string | null;
  active?: boolean;
  sortOrder?: number;
}): Promise<FixedCostRowT> {
  const row: Record<string, unknown> = {
    org_id: input.orgId,
    label: input.label,
    daily_cents: input.dailyCents,
    notes: input.notes ?? null,
    active: input.active ?? true,
    sort_order: input.sortOrder ?? 0,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await insforge.database
    .from('fixed_costs')
    .upsert(row)
    .select('*')
    .single();
  if (error) throw error;
  return FixedCostRow.parse(data);
}

export async function deleteFixedCost(id: string): Promise<void> {
  const { error } = await insforge.database
    .from('fixed_costs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// products.uber_price_cents — admin-only write path. Doesn't touch the
// existing upsert_product offline handler (which doesn't carry this field),
// so we patch the column directly.
// ---------------------------------------------------------------------------

export async function setProductUberPrice(input: {
  productId: string;
  uberPriceCents: number | null;
}): Promise<void> {
  const { error } = await insforge.database
    .from('products')
    .update({ uber_price_cents: input.uberPriceCents })
    .eq('id', input.productId);
  if (error) throw error;
}
