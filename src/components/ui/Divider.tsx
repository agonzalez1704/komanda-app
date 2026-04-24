import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color } from '@/theme/tokens';

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.line, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
    alignSelf: 'stretch',
  },
});
