import { StyleSheet, Text, View } from 'react-native';
import { useOnline } from '@/offline/network';

export function OfflineBanner() {
  const online = useOnline();
  if (online !== false) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline — changes will sync when reconnected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
