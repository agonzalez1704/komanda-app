import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Divider, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';

type Props<T extends { id: string }> = {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onSeeAll?: () => void;
};

export function RecentList<T extends { id: string }>({
  title,
  items,
  renderItem,
  onSeeAll,
}: Props<T>) {
  const visible = items.slice(0, 5);
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="label" style={{ flex: 1 }}>
          {title}
        </Text>
        {onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel={`View all ${title.toLowerCase()}`}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text variant="footnote" style={{ color: color.primary }}>
              View all
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Card padded={false}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="bodySm">Nothing yet.</Text>
          </View>
        ) : (
          visible.map((it, idx) => (
            <View key={it.id}>
              {idx > 0 ? <Divider style={{ marginLeft: space.lg }} /> : null}
              {renderItem(it)}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  empty: {
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
});
