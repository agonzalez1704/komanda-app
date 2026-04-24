import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '@/theme/tokens';
import { WarmCanvas } from './WarmCanvas';

export type ScreenProps = {
  children: ReactNode;
  scrollable?: boolean;
  /** Apply horizontal screen padding to the content area. Default true. */
  padded?: boolean;
  /** Include a keyboard-avoiding wrapper. Default false. */
  avoidKeyboard?: boolean;
  /** Content container style (when scrollable). */
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  /** Background color override. */
  background?: string;
  /** Safe-area edges to respect. Default: ['top','bottom']. */
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
  /** Extra bottom padding for the scroll content (use with footer). */
  bottomInset?: number;
  /** Fixed footer pinned to the bottom of the screen. */
  footer?: ReactNode;
  /**
   * Paint the warm-tinted canvas (gradient + saffron/terracotta halos) under
   * the content. Required on screens that host Liquid Glass chrome — glass
   * over a flat linen background looks grey. Default: true.
   */
  warm?: boolean;
  /**
   * Render the footer as a floating pill inset from the screen edges (spec
   * for Liquid Glass action bars). When false, the footer paints in a simple
   * band at the bottom — legacy behavior. Default: true.
   */
  floatingFooter?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scrollable = false,
  padded = true,
  avoidKeyboard = false,
  contentContainerStyle,
  background = color.bg,
  edges = ['top', 'bottom'],
  bottomInset = 0,
  footer,
  warm = true,
  floatingFooter = true,
  style,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const contentPadding: ViewStyle = {
    paddingHorizontal: padded ? space.lg : 0,
    paddingBottom: bottomInset || space.lg,
  };

  const body = scrollable ? (
    <ScrollView
      contentContainerStyle={[contentPadding, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentPadding]}>{children}</View>
  );

  const wrapped = avoidKeyboard ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView
      edges={edges}
      // When `warm` is on we want the SafeAreaView to be transparent so the
      // WarmCanvas underneath paints all the way up into the status-bar area.
      style={[
        styles.flex,
        { backgroundColor: warm ? 'transparent' : background },
        style,
      ]}
    >
      {warm ? <WarmCanvas /> : null}
      {wrapped}
      {footer ? (
        <View style={floatingFooter ? styles.footerFloating : styles.footer}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    paddingTop: space.sm,
    backgroundColor: 'transparent',
  },
  /**
   * Footer rendered as a floating Liquid Glass bar. The children are expected
   * to already be a `GlassSurface` (or a `Button` that we'll wrap at the call
   * site). We just provide outer breathing room so the bar doesn't collide
   * with the home-indicator area.
   */
  footerFloating: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    backgroundColor: 'transparent',
  },
});
