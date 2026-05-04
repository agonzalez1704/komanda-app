import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Screen, Text } from '@/components/ui';
import { color } from '@/theme/tokens';
import { fetchCombo } from '@/insforge/queries/combos';
import { fetchAllProducts, fetchAllVariants } from '@/insforge/queries/menu';
import { ComboFormShell } from '@/features/menu/components/ComboFormShell';

export default function EditComboScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const combo = useQuery({
    queryKey: ['combo', id],
    queryFn: () => fetchCombo(id!),
    enabled: !!id,
  });
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: fetchAllProducts,
  });
  const variants = useQuery({
    queryKey: ['variants', 'all'],
    queryFn: fetchAllVariants,
  });

  const productNames = useMemo(
    () =>
      Object.fromEntries(
        (products.data ?? []).map((p) => [p.id, p.name]),
      ),
    [products.data],
  );
  const variantNames = useMemo(
    () =>
      Object.fromEntries(
        (variants.data ?? []).map((v) => [v.id, v.name as string | null]),
      ),
    [variants.data],
  );

  if (combo.isPending || products.isPending || variants.isPending) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  if (!combo.data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="h3">Combo not found.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <ComboFormShell
      initial={combo.data}
      productNames={productNames}
      variantNames={variantNames}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
