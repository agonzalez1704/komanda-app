import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useOnline } from '@/offline/network';
import { color, fontWeight, space } from '@/theme/tokens';

export function OfflineBanner() {
  const online = useOnline();
  if (online !== false) return null;

  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Changes will sync when reconnected."
    >
      <Ionicons name="cloud-offline-outline" size={14} color={color.textInverse} />
      <Text
        style={{
          color: color.textInverse,
          fontSize: 12,
          fontWeight: fontWeight.semibold,
          letterSpacing: 0.2,
        }}
      >
        Offline — changes will sync when reconnected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: color.warning,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
