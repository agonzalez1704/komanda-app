import { insforge } from '@/insforge/client';
import {
  ProductRow,
  VariantRow,
  ModifierRow,
  type ProductRowT,
  type VariantRowT,
  type ModifierRowT,
} from '@/insforge/schemas';

// -----------------------------------------------------------------------------
// Add-item flow: active-only menu
// -----------------------------------------------------------------------------

export async function fetchProducts(): Promise<ProductRowT[]> {
  const { data, error } = await insforge.database
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ProductRow.parse(row));
}

export async function fetchVariants(): Promise<VariantRowT[]> {
  const { data, error } = await insforge.database
    .from('variants')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => VariantRow.parse(row));
}

export async function fetchModifiers(): Promise<ModifierRowT[]> {
  const { data, error } = await insforge.database
    .from('modifiers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ModifierRow.parse(row));
}

// -----------------------------------------------------------------------------
// Menu management: include inactive rows so they can be reactivated.
// Keyed separately in TanStack so the add-item cache stays lean.
// -----------------------------------------------------------------------------

export async function fetchAllProducts(): Promise<ProductRowT[]> {
  const { data, error } = await insforge.database
    .from('products')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ProductRow.parse(row));
}

export async function fetchAllVariants(): Promise<VariantRowT[]> {
  const { data, error } = await insforge.database
    .from('variants')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => VariantRow.parse(row));
}

export async function fetchAllModifiers(): Promise<ModifierRowT[]> {
  const { data, error } = await insforge.database
    .from('modifiers')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ModifierRow.parse(row));
}

export async function fetchProductById(id: string): Promise<ProductRowT | null> {
  const { data, error } = await insforge.database
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return ProductRow.parse(data);
}

export async function fetchVariantsForProduct(productId: string): Promise<VariantRowT[]> {
  const { data, error } = await insforge.database
    .from('variants')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => VariantRow.parse(row));
}
