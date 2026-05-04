import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Screen } from '@/components/ui';
import { color } from '@/theme/tokens';
import { fetchAllProducts, fetchAllVariants } from '@/insforge/queries/menu';
import { ComboFormShell } from '@/features/menu/components/ComboFormShell';

export default function NewComboScreen() {
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

  if (products.isLoading || variants.isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <ComboFormShell
      productNames={productNames}
      variantNames={variantNames}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
