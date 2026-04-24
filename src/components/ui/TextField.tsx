import { forwardRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { color, fontSize, fontWeight, layout, radius, space } from '@/theme/tokens';

export type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Decoration (text or node) rendered inside the input, flush-left. */
  leading?: ReactNode;
  /** Decoration rendered flush-right. */
  trailing?: ReactNode;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    required,
    containerStyle,
    leading,
    trailing,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
          {required ? <Text variant="label" style={{ color: color.danger }}>{' *'}</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputBox,
          focused && styles.inputBoxFocused,
          hasError && styles.inputBoxError,
        ]}
      >
        {leading ? <View style={styles.adornLeading}>{renderAdorn(leading)}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={color.textTertiary}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {trailing ? <View style={styles.adornTrailing}>{renderAdorn(trailing)}</View> : null}
      </View>
      {hasError ? (
        <Text variant="footnote" style={{ color: color.danger }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote">{hint}</Text>
      ) : null}
    </View>
  );
});

function renderAdorn(node: ReactNode): ReactNode {
  return typeof node === 'string' || typeof node === 'number' ? (
    <Text variant="bodyStrong" style={{ color: color.textTertiary }}>
      {node}
    </Text>
  ) : (
    node
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { marginBottom: 2 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  inputBoxFocused: {
    borderColor: color.primary,
    borderWidth: 1.5,
  },
  inputBoxError: {
    borderColor: color.danger,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: fontSize.bodyLg,
    color: color.textPrimary,
    fontWeight: fontWeight.regular,
    paddingVertical: 0,
  },
  adornLeading: { justifyContent: 'center' },
  adornTrailing: { justifyContent: 'center' },
});
