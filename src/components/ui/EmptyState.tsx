import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { color, space } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = 'receipt-outline', title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={40} color={color.textTertiary} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodySm" align="center">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxxxxl,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  iconWrap: {
    marginBottom: space.sm,
    opacity: 0.8,
  },
});
