import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchProducts } from '@/insforge/queries/menu';

export default function Komandas() {
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.header}>Komandas (placeholder)</Text>
      <Text style={styles.sub}>Menu items loaded from Insforge:</Text>
      {products.isLoading ? (
        <ActivityIndicator />
      ) : products.error ? (
        <Text style={styles.error}>Error: {(products.error as Error).message}</Text>
      ) : (
        <View style={{ gap: 4, marginTop: 8 }}>
          {products.data?.map((p) => (
            <Text key={p.id}>
              {p.name} — ${(p.price_cents / 100).toFixed(2)}
            </Text>
          )) ?? null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 8 },
  header: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 14, color: '#525252' },
  error: { color: '#dc2626' },
});
