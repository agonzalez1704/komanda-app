import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchProducts, fetchVariants, fetchModifiers } from '@/insforge/queries/menu';
import { QuantityStepper } from '@/components/QuantityStepper';
import { formatMXN } from '@/domain/money';
import { useAddItem } from '@/mutations/useAddItem';
import type { ProductRowT, VariantRowT, ModifierRowT } from '@/insforge/schemas';

type Step = 'product' | 'variant' | 'customize';

export default function AddItem() {
  const { id: komandaId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const variants = useQuery({ queryKey: ['variants'], queryFn: fetchVariants });
  const modifiers = useQuery({ queryKey: ['modifiers'], queryFn: fetchModifiers });
  const addItem = useAddItem();

  const [step, setStep] = useState<Step>('product');
  const [product, setProduct] = useState<ProductRowT | null>(null);
  const [variant, setVariant] = useState<VariantRowT | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [toggledMods, setToggledMods] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  const productVariants = useMemo(
    () => (product ? variants.data?.filter((v) => v.product_id === product.id) ?? [] : []),
    [product, variants.data]
  );

  function pickProduct(p: ProductRowT) {
    setProduct(p);
    setVariant(null);
    const vs = variants.data?.filter((v) => v.product_id === p.id) ?? [];
    setStep(vs.length > 0 ? 'variant' : 'customize');
  }

  async function confirm() {
    if (!product || !komandaId) return;
    const chosenMods: ModifierRowT[] =
      modifiers.data?.filter((m) => toggledMods.has(m.id)) ?? [];
    await addItem.mutateAsync({
      komanda_id: komandaId,
      product_id: product.id,
      variant_id: variant?.id ?? null,
      quantity,
      unit_price_cents: product.price_cents,
      product_name_snapshot: product.name,
      variant_name_snapshot: variant?.name ?? null,
      note_text: note.trim() || null,
      modifiers: chosenMods.map((m) => ({ modifier_id: m.id, name_snapshot: m.name })),
    });
    router.back();
  }

  if (products.isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;

  if (step === 'product') {
    return (
      <FlatList
        data={products.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.grid}
        numColumns={2}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => pickProduct(item)} style={styles.productCard}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productPrice}>{formatMXN(item.price_cents)}</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  if (step === 'variant' && product) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{product.name} — pick variant</Text>
        <ScrollView contentContainerStyle={styles.variantList}>
          {productVariants.map((v) => (
            <TouchableOpacity
              key={v.id}
              onPress={() => { setVariant(v); setStep('customize'); }}
              style={styles.variantChip}
            >
              <Text style={styles.variantText}>{v.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>
        {product?.name}{variant ? ` — ${variant.name}` : ''}
      </Text>
      <Text style={styles.label}>Quantity</Text>
      <QuantityStepper value={quantity} onChange={setQuantity} />
      <Text style={styles.label}>Modifiers</Text>
      <View style={styles.modRow}>
        {(modifiers.data ?? []).map((m) => {
          const on = toggledMods.has(m.id);
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => {
                const next = new Set(toggledMods);
                if (on) next.delete(m.id); else next.add(m.id);
                setToggledMods(next);
              }}
              style={[styles.modChip, on && styles.modChipActive]}
            >
              <Text style={[styles.modText, on && styles.modTextActive]}>{m.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.label}>Note</Text>
      <TextInput
        placeholder="e.g. extra salsa"
        value={note}
        onChangeText={setNote}
        style={styles.input}
      />
      <TouchableOpacity onPress={confirm} disabled={addItem.isPending} style={styles.primary}>
        <Text style={styles.primaryText}>
          Add to komanda · {formatMXN((product?.price_cents ?? 0) * quantity)}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { padding: 12, gap: 8 },
  productCard: { flex: 1, padding: 12, backgroundColor: 'white', borderRadius: 10, marginBottom: 8 },
  productName: { fontSize: 15, fontWeight: '600' },
  productPrice: { fontSize: 14, color: '#404040', marginTop: 4 },
  screen: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 12, color: '#737373', textTransform: 'uppercase', marginTop: 12 },
  variantList: { gap: 8 },
  variantChip: { padding: 14, backgroundColor: 'white', borderRadius: 10 },
  variantText: { fontSize: 16 },
  modRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#e5e5e5', borderRadius: 999 },
  modChipActive: { backgroundColor: '#111827' },
  modText: { fontSize: 13, color: '#404040' },
  modTextActive: { color: 'white', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, padding: 12, fontSize: 16 },
  primary: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
