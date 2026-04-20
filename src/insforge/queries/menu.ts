import { insforge } from '@/insforge/client';
import {
  ProductRow,
  VariantRow,
  ModifierRow,
  type ProductRowT,
  type VariantRowT,
  type ModifierRowT,
} from '@/insforge/schemas';

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
