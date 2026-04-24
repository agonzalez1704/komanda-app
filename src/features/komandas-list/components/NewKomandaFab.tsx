import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassSurface, Text } from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export function NewKomandaFab({ onPress }: { onPress: () => void }) {
  function handle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <GlassSurface variant="primary" radius={radius.full}>
        <Pressable
          onPress={handle}
          accessibilityRole="button"
          accessibilityLabel="New komanda"
          android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
          style={({ pressed }) => [
            styles.inner,
            pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Ionicons name="add" size={22} color={color.primaryOn} />
          <Text style={styles.label}>New komanda</Text>
        </Pressable>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    minHeight: 52,
  },
  label: {
    color: color.primaryOn,
    fontWeight: fontWeight.semibold,
    fontSize: 16,
  },
});
